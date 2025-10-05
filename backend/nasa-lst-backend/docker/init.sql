-- Create LST Data table (normalized structure)
CREATE TABLE IF NOT EXISTS lst_tr_sf_data (
    id SERIAL PRIMARY KEY,
    xllcorner DECIMAL(12,2),
    yllcorner DECIMAL(12,2),
    cellsize DECIMAL(15,10),
    nrows INTEGER,
    ncols INTEGER,
    band VARCHAR(50),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    header TEXT,
    -- Normalized subset fields (each JSON object becomes a row)
    subset_band VARCHAR(50),
    subset_calendar_date DATE,
    subset_modis_date VARCHAR(20),
    subset_data JSONB, -- Array of values from the original 'data' field
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create VGT NDVI/EVI Data table (normalized structure)
CREATE TABLE IF NOT EXISTS vgt_ndvi_evi_data (
    id SERIAL PRIMARY KEY,
    xllcorner DECIMAL(12,2),
    yllcorner DECIMAL(12,2),
    cellsize DECIMAL(15,10),
    nrows INTEGER,
    ncols INTEGER,
    band VARCHAR(50),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    header TEXT,
    -- Normalized subset fields (each JSON object becomes a row)
    subset_band VARCHAR(50),
    subset_calendar_date DATE,
    subset_modis_date VARCHAR(20),
    subset_data JSONB, -- Array of values from the original 'data' field
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes for normalized structure
CREATE INDEX IF NOT EXISTS idx_lst_location ON lst_tr_sf_data (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_lst_location_band ON lst_tr_sf_data (latitude, longitude, subset_band);
CREATE INDEX IF NOT EXISTS idx_lst_band ON lst_tr_sf_data (subset_band);
CREATE INDEX IF NOT EXISTS idx_lst_date ON lst_tr_sf_data (subset_calendar_date);
CREATE INDEX IF NOT EXISTS idx_lst_compound ON lst_tr_sf_data (latitude, longitude, subset_band, subset_calendar_date);

CREATE INDEX IF NOT EXISTS idx_vgt_location ON vgt_ndvi_evi_data (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vgt_location_band ON vgt_ndvi_evi_data (latitude, longitude, subset_band);
CREATE INDEX IF NOT EXISTS idx_vgt_band ON vgt_ndvi_evi_data (subset_band);
CREATE INDEX IF NOT EXISTS idx_vgt_date ON vgt_ndvi_evi_data (subset_calendar_date);
CREATE INDEX IF NOT EXISTS idx_vgt_compound ON vgt_ndvi_evi_data (latitude, longitude, subset_band, subset_calendar_date);

-- Create function to filter LST data by date range (updated for normalized structure)
CREATE OR REPLACE FUNCTION filter_lst_by_date(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    id INTEGER,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    band VARCHAR(50),
    subset_band VARCHAR(50),
    subset_calendar_date DATE,
    subset_modis_date VARCHAR(20),
    subset_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ld.id,
        ld.latitude,
        ld.longitude,
        ld.band,
        ld.subset_band,
        ld.subset_calendar_date,
        ld.subset_modis_date,
        ld.subset_data
    FROM lst_tr_sf_data ld
    WHERE ld.subset_calendar_date BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Create function to get temperature statistics by location (updated for normalized structure)
CREATE OR REPLACE FUNCTION get_temperature_stats(
    lat_min DECIMAL(10,6),
    lat_max DECIMAL(10,6),
    lon_min DECIMAL(10,6),
    lon_max DECIMAL(10,6)
)
RETURNS TABLE (
    location_id INTEGER,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    avg_temp DECIMAL(10,2),
    min_temp DECIMAL(10,2),
    max_temp DECIMAL(10,2),
    data_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH temp_data AS (
        SELECT 
            ld.id,
            ld.latitude,
            ld.longitude,
            jsonb_array_elements_text(ld.subset_data)::DECIMAL * ld.scale::DECIMAL AS temp_kelvin
        FROM lst_tr_sf_data ld
        WHERE ld.latitude BETWEEN lat_min AND lat_max
        AND ld.longitude BETWEEN lon_min AND lon_max
        AND ld.subset_band = 'LST_Day_1km'
    )
    SELECT 
        td.id,
        td.latitude,
        td.longitude,
        ROUND(AVG(td.temp_kelvin - 273.15), 2) as avg_temp,  -- Convert to Celsius
        ROUND(MIN(td.temp_kelvin - 273.15), 2) as min_temp,
        ROUND(MAX(td.temp_kelvin - 273.15), 2) as max_temp,
        COUNT(*)::INTEGER as data_points
    FROM temp_data td
    GROUP BY td.id, td.latitude, td.longitude;
END;
$$ LANGUAGE plpgsql;

-- Create function to get NDVI/EVI vegetation statistics by location (updated for normalized structure)
CREATE OR REPLACE FUNCTION get_vegetation_stats(
    lat_min DECIMAL(10,6),
    lat_max DECIMAL(10,6),
    lon_min DECIMAL(10,6),
    lon_max DECIMAL(10,6),
    band_name VARCHAR(50) DEFAULT 'NDVI'
)
RETURNS TABLE (
    location_id INTEGER,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    band VARCHAR(50),
    avg_value DECIMAL(10,4),
    min_value DECIMAL(10,4),
    max_value DECIMAL(10,4),
    data_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH veg_data AS (
        SELECT 
            vd.id,
            vd.latitude,
            vd.longitude,
            vd.subset_band,
            jsonb_array_elements_text(vd.subset_data)::DECIMAL * vd.scale::DECIMAL AS veg_value
        FROM vgt_ndvi_evi_data vd
        WHERE vd.latitude BETWEEN lat_min AND lat_max
        AND vd.longitude BETWEEN lon_min AND lon_max
        AND (band_name IS NULL OR vd.subset_band ILIKE '%' || band_name || '%')
    )
    SELECT 
        vd.id,
        vd.latitude,
        vd.longitude,
        vd.subset_band,
        ROUND(AVG(vd.veg_value), 4) as avg_value,
        ROUND(MIN(vd.veg_value), 4) as min_value,
        ROUND(MAX(vd.veg_value), 4) as max_value,
        COUNT(*)::INTEGER as data_points
    FROM veg_data vd
    GROUP BY vd.id, vd.latitude, vd.longitude, vd.subset_band;
END;
$$ LANGUAGE plpgsql;

-- Create function to get combined data (LST + VGT) for comprehensive analysis
CREATE OR REPLACE FUNCTION get_combined_climate_data(
    target_latitude DECIMAL(10,6) DEFAULT NULL,
    target_longitude DECIMAL(10,6) DEFAULT NULL,
    date_filter DATE DEFAULT NULL
)
RETURNS TABLE (
    location_lat DECIMAL(10,6),
    location_lon DECIMAL(10,6),
    calendar_date DATE,
    lst_day_temp DECIMAL(10,4),
    lst_night_temp DECIMAL(10,4),
    ndvi_value DECIMAL(10,4),
    evi_value DECIMAL(10,4),
    data_completeness TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH location_dates AS (
        SELECT DISTINCT 
            COALESCE(ls.latitude, vs.latitude) as lat,
            COALESCE(ls.longitude, vs.longitude) as lon,
            COALESCE(ls.calendar_date, vs.calendar_date) as cal_date
        FROM lst_statistics ls
        FULL OUTER JOIN vgt_statistics vs ON (
            ls.latitude = vs.latitude 
            AND ls.longitude = vs.longitude 
            AND ls.calendar_date = vs.calendar_date
        )
        WHERE 
            (target_latitude IS NULL OR COALESCE(ls.latitude, vs.latitude) = target_latitude)
            AND (target_longitude IS NULL OR COALESCE(ls.longitude, vs.longitude) = target_longitude)
            AND (date_filter IS NULL OR COALESCE(ls.calendar_date, vs.calendar_date) = date_filter)
    )
    SELECT 
        ld.lat,
        ld.lon,
        ld.cal_date,
        lst_day.value_mean as lst_day_temp,
        lst_night.value_mean as lst_night_temp,
        ndvi.value_mean as ndvi_value,
        evi.value_mean as evi_value,
        CASE 
            WHEN lst_day.value_mean IS NOT NULL AND lst_night.value_mean IS NOT NULL 
                 AND ndvi.value_mean IS NOT NULL AND evi.value_mean IS NOT NULL THEN 'Complete'
            WHEN lst_day.value_mean IS NOT NULL OR lst_night.value_mean IS NOT NULL 
                 OR ndvi.value_mean IS NOT NULL OR evi.value_mean IS NOT NULL THEN 'Partial'
            ELSE 'No Data'
        END as data_completeness
    FROM location_dates ld
    LEFT JOIN lst_statistics lst_day ON (
        ld.lat = lst_day.latitude AND ld.lon = lst_day.longitude 
        AND ld.cal_date = lst_day.calendar_date AND lst_day.band = 'LST_Day_1km'
    )
    LEFT JOIN lst_statistics lst_night ON (
        ld.lat = lst_night.latitude AND ld.lon = lst_night.longitude 
        AND ld.cal_date = lst_night.calendar_date AND lst_night.band = 'LST_Night_1km'
    )
    LEFT JOIN vgt_statistics ndvi ON (
        ld.lat = ndvi.latitude AND ld.lon = ndvi.longitude 
        AND ld.cal_date = ndvi.calendar_date AND ndvi.band ILIKE '%NDVI%'
    )
    LEFT JOIN vgt_statistics evi ON (
        ld.lat = evi.latitude AND ld.lon = evi.longitude 
        AND ld.cal_date = evi.calendar_date AND evi.band ILIKE '%EVI%'
    )
    ORDER BY ld.lat, ld.lon, ld.cal_date;
END;
$$ LANGUAGE plpgsql;

-- Create RLS (Row Level Security) policies if needed
-- ALTER TABLE lst_data ENABLE ROW LEVEL SECURITY;

-- Create LST Statistics table
CREATE TABLE IF NOT EXISTS lst_statistics (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    modis_date VARCHAR(20) NOT NULL,
    calendar_date DATE NOT NULL,
    band VARCHAR(50) NOT NULL,
    value_center VARCHAR(50),
    value_min DECIMAL(10,4),
    value_max DECIMAL(10,4),
    value_sum DECIMAL(15,4),
    value_range DECIMAL(10,4),
    value_mean DECIMAL(10,4),
    value_variance DECIMAL(10,4),
    value_stddev DECIMAL(10,4),
    pixels_total INTEGER,
    pixels_pass INTEGER,
    pixels_pass_rel DECIMAL(5,2),
    proc_date VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create VGT NDVI/EVI Statistics table
CREATE TABLE IF NOT EXISTS vgt_statistics (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    modis_date VARCHAR(20) NOT NULL,
    calendar_date DATE NOT NULL,
    band VARCHAR(50) NOT NULL,
    value_center VARCHAR(50),
    value_min DECIMAL(10,4),
    value_max DECIMAL(10,4),
    value_sum DECIMAL(15,4),
    value_range DECIMAL(10,4),
    value_mean DECIMAL(10,4),
    value_variance DECIMAL(10,4),
    value_stddev DECIMAL(10,4),
    pixels_total INTEGER,
    pixels_pass INTEGER,
    pixels_pass_rel DECIMAL(5,2),
    proc_date VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes for statistics tables
CREATE INDEX IF NOT EXISTS idx_lst_statistics_location ON lst_statistics (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_location_band ON lst_statistics (latitude, longitude, band);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_band_location ON lst_statistics (band, latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_calendar_date ON lst_statistics (calendar_date);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_compound ON lst_statistics (latitude, longitude, band, calendar_date);

CREATE INDEX IF NOT EXISTS idx_vgt_statistics_location ON vgt_statistics (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_location_band ON vgt_statistics (latitude, longitude, band);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_band_location ON vgt_statistics (band, latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_calendar_date ON vgt_statistics (calendar_date);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_compound ON vgt_statistics (latitude, longitude, band, calendar_date);

-- Drop old function signature to avoid overload conflicts
DROP FUNCTION IF EXISTS get_lst_data_with_statistics(DECIMAL(10,6), DECIMAL(10,6), VARCHAR(50));

-- Create super-optimized function using normalized structure
CREATE OR REPLACE FUNCTION get_lst_data_with_statistics(
    target_latitude DECIMAL(10,6) DEFAULT NULL,
    target_longitude DECIMAL(10,6) DEFAULT NULL,
    band_filter VARCHAR(50) DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    lst_id INTEGER,
    lat DECIMAL(10,6),
    lon DECIMAL(10,6),
    lst_band VARCHAR(50),
    subset_band VARCHAR(50),
    subset_calendar_date DATE,
    subset_modis_date VARCHAR(20),
    modis_date VARCHAR(20),
    calendar_date DATE,
    value_center VARCHAR(50),
    value_min DECIMAL(10,4),
    value_max DECIMAL(10,4),
    value_mean DECIMAL(10,4),
    value_stddev DECIMAL(10,4),
    pixels_total INTEGER,
    pixels_pass INTEGER
) AS $$
BEGIN
    -- Super-optimized: direct column matching, no JSONB operations
    RETURN QUERY
    SELECT
        ld.id as lst_id,
        ld.latitude as lat,
        ld.longitude as lon,
        ld.band as lst_band,
        ld.subset_band,
        ld.subset_calendar_date,
        ld.subset_modis_date,
        ls.modis_date,
        ls.calendar_date,
        ls.value_center,
        ls.value_min,
        ls.value_max,
        ls.value_mean,
        ls.value_stddev,
        ls.pixels_total,
        ls.pixels_pass
    FROM lst_tr_sf_data ld
    INNER JOIN lst_statistics ls ON (
        ld.latitude = ls.latitude
        AND ld.longitude = ls.longitude
        AND ld.subset_band = ls.band
    )
    WHERE
        (target_latitude IS NULL OR ld.latitude = target_latitude)
        AND (target_longitude IS NULL OR ld.longitude = target_longitude)
        AND (band_filter IS NULL OR ld.subset_band = band_filter)
    ORDER BY ld.latitude, ld.longitude, ls.calendar_date
    LIMIT COALESCE(limit_count, 10);
END;
$$ LANGUAGE plpgsql;

-- Drop old function signature to avoid overload conflicts
DROP FUNCTION IF EXISTS get_vgt_data_with_statistics(DECIMAL(10,6), DECIMAL(10,6), VARCHAR(50));

-- Create super-optimized function using normalized structure
CREATE OR REPLACE FUNCTION get_vgt_data_with_statistics(
    target_latitude DECIMAL(10,6) DEFAULT NULL,
    target_longitude DECIMAL(10,6) DEFAULT NULL,
    band_filter VARCHAR(50) DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    vgt_id INTEGER,
    lat DECIMAL(10,6),
    lon DECIMAL(10,6),
    vgt_band VARCHAR(50),
    subset_band VARCHAR(50),
    subset_calendar_date DATE,
    subset_modis_date VARCHAR(20),
    modis_date VARCHAR(20),
    calendar_date DATE,
    value_center VARCHAR(50),
    value_min DECIMAL(10,4),
    value_max DECIMAL(10,4),
    value_mean DECIMAL(10,4),
    value_stddev DECIMAL(10,4),
    pixels_total INTEGER,
    pixels_pass INTEGER
) AS $$
BEGIN
    -- Super-optimized: direct column matching, no JSONB operations
    RETURN QUERY
    SELECT 
        vd.id as vgt_id,
        vd.latitude as lat,
        vd.longitude as lon,
        vd.band as vgt_band,
        vd.subset_band,
        vd.subset_calendar_date,
        vd.subset_modis_date,
        vs.modis_date,
        vs.calendar_date,
        vs.value_center,
        vs.value_min,
        vs.value_max,
        vs.value_mean,
        vs.value_stddev,
        vs.pixels_total,
        vs.pixels_pass
    FROM vgt_ndvi_evi_data vd
    INNER JOIN vgt_statistics vs ON (
        vd.latitude = vs.latitude 
        AND vd.longitude = vs.longitude
        AND vd.subset_band = vs.band
    )
    WHERE 
        (target_latitude IS NULL OR vd.latitude = target_latitude)
        AND (target_longitude IS NULL OR vd.longitude = target_longitude)
        AND (band_filter IS NULL OR vd.subset_band = band_filter)
    ORDER BY vd.latitude, vd.longitude, vs.calendar_date
    LIMIT COALESCE(limit_count, 10);
END;
$$ LANGUAGE plpgsql;

-- Create function to insert LST data with old JSONB format (adapts to new normalized structure)
CREATE OR REPLACE FUNCTION insert_lst_data(
    xllcorner DECIMAL(12,2),
    yllcorner DECIMAL(12,2),
    cellsize DECIMAL(15,10),
    nrows INTEGER,
    ncols INTEGER,
    band VARCHAR(50),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    header TEXT,
    subset JSONB
)
RETURNS TABLE (
    inserted_count INTEGER
) AS $$
DECLARE
    count_inserted INTEGER := 0;
BEGIN
    -- Insert each subset item as a separate row in the normalized structure
    INSERT INTO lst_tr_sf_data (
        xllcorner, yllcorner, cellsize, nrows, ncols, band,
        latitude, longitude, header, subset_band, subset_calendar_date, 
        subset_modis_date, subset_data
    )
    SELECT 
        insert_lst_data.xllcorner, insert_lst_data.yllcorner, insert_lst_data.cellsize, insert_lst_data.nrows, insert_lst_data.ncols, 
        insert_lst_data.band, insert_lst_data.latitude, insert_lst_data.longitude, insert_lst_data.header,
        subset_item->>'band' as subset_band,
        (subset_item->>'calendar_date')::DATE as subset_calendar_date,
        subset_item->>'modis_date' as subset_modis_date,
        subset_item->'data' as subset_data
    FROM jsonb_array_elements(insert_lst_data.subset) AS subset_item;
    
    GET DIAGNOSTICS count_inserted = ROW_COUNT;
    
    RETURN QUERY SELECT count_inserted;
END;
$$ LANGUAGE plpgsql;

-- Create function to insert VGT data with old JSONB format (adapts to new normalized structure)
CREATE OR REPLACE FUNCTION insert_vgt_data(
    xllcorner DECIMAL(12,2),
    yllcorner DECIMAL(12,2),
    cellsize DECIMAL(15,10),
    nrows INTEGER,
    ncols INTEGER,
    band VARCHAR(50),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    header TEXT,
    subset JSONB
)
RETURNS TABLE (
    inserted_count INTEGER
) AS $$
DECLARE
    count_inserted INTEGER := 0;
BEGIN
    -- Insert each subset item as a separate row in the normalized structure
    INSERT INTO vgt_ndvi_evi_data (
        xllcorner, yllcorner, cellsize, nrows, ncols, band,
        latitude, longitude, header, subset_band, subset_calendar_date, 
        subset_modis_date, subset_data
    )
    SELECT 
        insert_vgt_data.xllcorner, insert_vgt_data.yllcorner, insert_vgt_data.cellsize, insert_vgt_data.nrows, insert_vgt_data.ncols, 
        insert_vgt_data.band, insert_vgt_data.latitude, insert_vgt_data.longitude, insert_vgt_data.header,
        subset_item->>'band' as subset_band,
        (subset_item->>'calendar_date')::DATE as subset_calendar_date,
        subset_item->>'modis_date' as subset_modis_date,
        subset_item->'data' as subset_data
    FROM jsonb_array_elements(insert_vgt_data.subset) AS subset_item;
    
    GET DIAGNOSTICS count_inserted = ROW_COUNT;
    
    RETURN QUERY SELECT count_inserted;
END;
$$ LANGUAGE plpgsql;

-- Create function to insert LST data from JSON (PostgREST compatible)
CREATE OR REPLACE FUNCTION insert_lst_data_from_json(
    data_json JSONB
)
RETURNS TABLE (
    inserted_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM insert_lst_data(
        (data_json->>'xllcorner')::DECIMAL(12,2),
        (data_json->>'yllcorner')::DECIMAL(12,2),
        (data_json->>'cellsize')::DECIMAL(15,10),
        (data_json->>'nrows')::INTEGER,
        (data_json->>'ncols')::INTEGER,
        (data_json->>'band')::VARCHAR(50),
        (data_json->>'latitude')::DECIMAL(10,6),
        (data_json->>'longitude')::DECIMAL(10,6),
        (data_json->>'header')::TEXT,
        data_json->'subset'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to insert VGT data from JSON (PostgREST compatible)
CREATE OR REPLACE FUNCTION insert_vgt_data_from_json(
    data_json JSONB
)
RETURNS TABLE (
    inserted_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM insert_vgt_data(
        (data_json->>'xllcorner')::DECIMAL(12,2),
        (data_json->>'yllcorner')::DECIMAL(12,2),
        (data_json->>'cellsize')::DECIMAL(15,10),
        (data_json->>'nrows')::INTEGER,
        (data_json->>'ncols')::INTEGER,
        (data_json->>'band')::VARCHAR(50),
        (data_json->>'latitude')::DECIMAL(10,6),
        (data_json->>'longitude')::DECIMAL(10,6),
        (data_json->>'header')::TEXT,
        data_json->'subset'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to debug data availability
CREATE OR REPLACE FUNCTION debug_data_availability()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    sample_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'lst_tr_sf_data'::TEXT as table_name,
        COUNT(*)::BIGINT as row_count,
        jsonb_build_object(
            'sample_id', MIN(id),
            'sample_lat', MIN(latitude),
            'sample_lon', MIN(longitude),
            'sample_band', MIN(band)
        ) as sample_data
    FROM lst_tr_sf_data
    
    UNION ALL
    
    SELECT 
        'lst_statistics'::TEXT as table_name,
        COUNT(*)::BIGINT as row_count,
        jsonb_build_object(
            'sample_id', MIN(id),
            'sample_lat', MIN(latitude),
            'sample_lon', MIN(longitude),
            'sample_band', MIN(band)
        ) as sample_data
    FROM lst_statistics
    
    UNION ALL
    
    SELECT 
        'vgt_ndvi_evi_data'::TEXT as table_name,
        COUNT(*)::BIGINT as row_count,
        jsonb_build_object(
            'sample_id', MIN(id),
            'sample_lat', MIN(latitude),
            'sample_lon', MIN(longitude),
            'sample_band', MIN(band)
        ) as sample_data
    FROM vgt_ndvi_evi_data
    
    UNION ALL
    
    SELECT 
        'vgt_statistics'::TEXT as table_name,
        COUNT(*)::BIGINT as row_count,
        jsonb_build_object(
            'sample_id', MIN(id),
            'sample_lat', MIN(latitude),
            'sample_lon', MIN(longitude),
            'sample_band', MIN(band)
        ) as sample_data
    FROM vgt_statistics;
END;
$$ LANGUAGE plpgsql;

-- Create function to insert LST statistics data with coordinates
CREATE OR REPLACE FUNCTION insert_lst_statistics(
    data_json JSONB
)
RETURNS TABLE (
    inserted_count INTEGER
) AS $$
DECLARE
    stat_record RECORD;
    count_inserted INTEGER := 0;
    input_latitude DECIMAL(10,6);
    input_longitude DECIMAL(10,6);
BEGIN
    -- Extract latitude and longitude from input JSON
    input_latitude := (data_json->>'latitude')::DECIMAL(10,6);
    input_longitude := (data_json->>'longitude')::DECIMAL(10,6);
    
    FOR stat_record IN 
        SELECT 
            input_latitude as latitude,
            input_longitude as longitude,
            (item->>'modis_date')::VARCHAR(20) as modis_date,
            (item->>'calendar_date')::DATE as calendar_date,
            (item->>'band')::VARCHAR(50) as band,
            (item->>'value_center')::VARCHAR(50) as value_center,
            (item->>'value_min')::DECIMAL(10,4) as value_min,
            (item->>'value_max')::DECIMAL(10,4) as value_max,
            (item->>'value_sum')::DECIMAL(15,4) as value_sum,
            (item->>'value_range')::DECIMAL(10,4) as value_range,
            (item->>'value_mean')::DECIMAL(10,4) as value_mean,
            (item->>'value_variance')::DECIMAL(10,4) as value_variance,
            (item->>'value_stddev')::DECIMAL(10,4) as value_stddev,
            (item->>'pixels_total')::INTEGER as pixels_total,
            (item->>'pixels_pass')::INTEGER as pixels_pass,
            (item->>'pixels_pass_rel')::DECIMAL(5,2) as pixels_pass_rel,
            (item->>'proc_date')::VARCHAR(20) as proc_date
        FROM jsonb_array_elements(data_json->'statistics') AS item
    LOOP
        INSERT INTO lst_statistics (
            latitude, longitude, modis_date, calendar_date, band, value_center, value_min, value_max,
            value_sum, value_range, value_mean, value_variance, value_stddev,
            pixels_total, pixels_pass, pixels_pass_rel, proc_date
        ) VALUES (
            stat_record.latitude, stat_record.longitude, stat_record.modis_date, stat_record.calendar_date, stat_record.band,
            stat_record.value_center, stat_record.value_min, stat_record.value_max,
            stat_record.value_sum, stat_record.value_range, stat_record.value_mean,
            stat_record.value_variance, stat_record.value_stddev, stat_record.pixels_total,
            stat_record.pixels_pass, stat_record.pixels_pass_rel, stat_record.proc_date
        );
        count_inserted := count_inserted + 1;
    END LOOP;
    
    RETURN QUERY SELECT count_inserted;
END;
$$ LANGUAGE plpgsql;

-- Create function to insert VGT statistics data with coordinates
CREATE OR REPLACE FUNCTION insert_vgt_statistics(
    data_json JSONB
)
RETURNS TABLE (
    inserted_count INTEGER
) AS $$
DECLARE
    stat_record RECORD;
    count_inserted INTEGER := 0;
    input_latitude DECIMAL(10,6);
    input_longitude DECIMAL(10,6);
BEGIN
    -- Extract latitude and longitude from input JSON
    input_latitude := (data_json->>'latitude')::DECIMAL(10,6);
    input_longitude := (data_json->>'longitude')::DECIMAL(10,6);
    
    FOR stat_record IN 
        SELECT 
            input_latitude as latitude,
            input_longitude as longitude,
            (item->>'modis_date')::VARCHAR(20) as modis_date,
            (item->>'calendar_date')::DATE as calendar_date,
            (item->>'band')::VARCHAR(50) as band,
            (item->>'value_center')::VARCHAR(50) as value_center,
            (item->>'value_min')::DECIMAL(10,4) as value_min,
            (item->>'value_max')::DECIMAL(10,4) as value_max,
            (item->>'value_sum')::DECIMAL(15,4) as value_sum,
            (item->>'value_range')::DECIMAL(10,4) as value_range,
            (item->>'value_mean')::DECIMAL(10,4) as value_mean,
            (item->>'value_variance')::DECIMAL(10,4) as value_variance,
            (item->>'value_stddev')::DECIMAL(10,4) as value_stddev,
            (item->>'pixels_total')::INTEGER as pixels_total,
            (item->>'pixels_pass')::INTEGER as pixels_pass,
            (item->>'pixels_pass_rel')::DECIMAL(5,2) as pixels_pass_rel,
            (item->>'proc_date')::VARCHAR(20) as proc_date
        FROM jsonb_array_elements(data_json->'statistics') AS item
    LOOP
        INSERT INTO vgt_statistics (
            latitude, longitude, modis_date, calendar_date, band, value_center, value_min, value_max,
            value_sum, value_range, value_mean, value_variance, value_stddev,
            pixels_total, pixels_pass, pixels_pass_rel, proc_date
        ) VALUES (
            stat_record.latitude, stat_record.longitude, stat_record.modis_date, stat_record.calendar_date, stat_record.band,
            stat_record.value_center, stat_record.value_min, stat_record.value_max,
            stat_record.value_sum, stat_record.value_range, stat_record.value_mean,
            stat_record.value_variance, stat_record.value_stddev, stat_record.pixels_total,
            stat_record.pixels_pass, stat_record.pixels_pass_rel, stat_record.proc_date
        );
        count_inserted := count_inserted + 1;
    END LOOP;
    
    RETURN QUERY SELECT count_inserted;
END;
$$ LANGUAGE plpgsql;

-- Create function to refresh PostgREST schema cache
CREATE OR REPLACE FUNCTION refresh_postgrest_cache()
RETURNS TEXT AS $$
BEGIN
    -- Notify PostgREST to reload its schema cache
    NOTIFY pgrst, 'reload schema';
    RETURN 'PostgREST schema cache refresh requested';
END;
$$ LANGUAGE plpgsql;

-- Create function to get current schema information for PostgREST
CREATE OR REPLACE FUNCTION get_schema_info()
RETURNS TABLE (
    table_schema TEXT,
    table_name TEXT,
    table_type TEXT,
    is_insertable_into TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_schema::TEXT,
        t.table_name::TEXT,
        t.table_type::TEXT,
        t.is_insertable_into::TEXT
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to get available functions for PostgREST API
CREATE OR REPLACE FUNCTION get_available_functions()
RETURNS TABLE (
    function_name TEXT,
    return_type TEXT,
    function_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.proname::TEXT as function_name,
        pg_get_function_result(p.oid)::TEXT as return_type,
        CASE 
            WHEN p.proretset THEN 'table'
            ELSE 'scalar'
        END::TEXT as function_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'
    AND p.proname NOT LIKE 'information_schema_%'
    ORDER BY p.proname;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to PostgREST user
GRANT USAGE ON SCHEMA public TO nasa_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nasa_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nasa_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nasa_user;

-- Grant specific permissions for new VGT tables
GRANT SELECT, INSERT, UPDATE, DELETE ON vgt_ndvi_evi_data TO nasa_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON vgt_statistics TO nasa_user;

-- Grant permissions for cache management functions
GRANT EXECUTE ON FUNCTION refresh_postgrest_cache() TO nasa_user;
GRANT EXECUTE ON FUNCTION get_schema_info() TO nasa_user;
GRANT EXECUTE ON FUNCTION get_available_functions() TO nasa_user;

-- Refresh PostgREST cache after setup
SELECT refresh_postgrest_cache();