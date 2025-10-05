-- Create LST Data table
CREATE TABLE IF NOT EXISTS lst_tr_sf_data (
    id SERIAL PRIMARY KEY,
    xllcorner DECIMAL(12,2),
    yllcorner DECIMAL(12,2),
    cellsize DECIMAL(15,10),
    nrows INTEGER,
    ncols INTEGER,
    band VARCHAR(50),
    units VARCHAR(20),
    scale DECIMAL(10,8),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    header TEXT,
    subset JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on location for spatial queries
CREATE INDEX IF NOT EXISTS idx_lst_location ON lst_tr_sf_data (latitude, longitude);

-- Create index on subset for JSON queries
CREATE INDEX IF NOT EXISTS idx_lst_subset ON lst_tr_sf_data USING GIN (subset);

-- Create function to filter data by date range
CREATE OR REPLACE FUNCTION filter_lst_by_date(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    id INTEGER,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    band VARCHAR(50),
    units VARCHAR(20),
    filtered_subset JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ld.id,
        ld.latitude,
        ld.longitude,
        ld.band,
        ld.units,
        jsonb_agg(
            subset_item
        ) as filtered_subset
    FROM lst_tr_sf_data ld,
    LATERAL jsonb_array_elements(ld.subset) AS subset_item
    WHERE (subset_item->>'calendar_date')::date BETWEEN start_date AND end_date
    GROUP BY ld.id, ld.latitude, ld.longitude, ld.band, ld.units;
END;
$$ LANGUAGE plpgsql;

-- Create function to get temperature statistics by location
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
            jsonb_array_elements_text(subset_item->'data')::DECIMAL * ld.scale::DECIMAL AS temp_kelvin
        FROM lst_tr_sf_data ld,
        LATERAL jsonb_array_elements(ld.subset) AS subset_item
        WHERE ld.latitude BETWEEN lat_min AND lat_max
        AND ld.longitude BETWEEN lon_min AND lon_max
        AND ld.band = 'LST_Day_1km'
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

-- Create indexes for statistics table
CREATE INDEX IF NOT EXISTS idx_lst_statistics_location ON lst_statistics (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_modis_date_band ON lst_statistics (modis_date, band);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_calendar_date ON lst_statistics (calendar_date);
CREATE INDEX IF NOT EXISTS idx_lst_statistics_band ON lst_statistics (band);

-- Create function to get combined LST data with statistics
CREATE OR REPLACE FUNCTION get_lst_data_with_statistics(
    target_latitude DECIMAL(10,6) DEFAULT NULL,
    target_longitude DECIMAL(10,6) DEFAULT NULL,
    band_filter VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    lst_id INTEGER,
    lat DECIMAL(10,6),
    lon DECIMAL(10,6),
    lst_band VARCHAR(50),
    lst_units VARCHAR(20),
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
    RETURN QUERY
    SELECT 
        ld.id as lst_id,
        ld.latitude as lat,
        ld.longitude as lon,
        COALESCE(ls.band, ld.band) as lst_band,
        ld.units as lst_units,
        COALESCE(ls.modis_date, 'N/A') as modis_date,
        ls.calendar_date,
        ls.value_center,
        ls.value_min,
        ls.value_max,
        ls.value_mean,
        ls.value_stddev,
        ls.pixels_total,
        ls.pixels_pass
    FROM lst_tr_sf_data ld
    LEFT JOIN lst_statistics ls ON (
        ld.latitude = ls.latitude 
        AND ld.longitude = ls.longitude
        AND (band_filter IS NULL OR ld.band = band_filter OR ls.band = band_filter)
    )
    WHERE 
        (target_latitude IS NULL OR ld.latitude = target_latitude)
        AND (target_longitude IS NULL OR ld.longitude = target_longitude)
        AND (band_filter IS NULL OR ld.band = band_filter)
    ORDER BY ld.latitude, ld.longitude, ls.calendar_date;
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
    FROM lst_statistics;
END;
$$ LANGUAGE plpgsql;

-- Create function to insert statistics data with coordinates
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





-- Create VGT NDVI/EVI Data table (same structure as LST)
CREATE TABLE IF NOT EXISTS vgt_ndvi_evi_data (
    id SERIAL PRIMARY KEY,
    xllcorner DECIMAL(12,2),
    yllcorner DECIMAL(12,2),
    cellsize DECIMAL(15,10),
    nrows INTEGER,
    ncols INTEGER,
    band VARCHAR(50),
    units VARCHAR(20),
    scale DECIMAL(10,8),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    header TEXT,
    subset JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vgt_location ON vgt_ndvi_evi_data (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vgt_subset ON vgt_ndvi_evi_data USING GIN (subset);



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



CREATE INDEX IF NOT EXISTS idx_vgt_statistics_location ON vgt_statistics (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_modis_date_band ON vgt_statistics (modis_date, band);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_calendar_date ON vgt_statistics (calendar_date);
CREATE INDEX IF NOT EXISTS idx_vgt_statistics_band ON vgt_statistics (band);

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



-- Grant permissions to PostgREST user
GRANT USAGE ON SCHEMA public TO nasa_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nasa_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nasa_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nasa_user;










GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nasa_user;

-- Grant specific permissions for new VGT tables
GRANT SELECT, INSERT, UPDATE, DELETE ON vgt_ndvi_evi_data TO nasa_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON vgt_statistics TO nasa_user;