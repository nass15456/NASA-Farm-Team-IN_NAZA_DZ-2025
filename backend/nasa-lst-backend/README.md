# NASA LST Backend API

A Node.js backend API for managing NASA Land Surface Temperature (LST) data with PostgreSQL database and PostgREST integration.

## 🏗️ Architecture

```
Client Request → Node.js API → PostgREST → PostgreSQL
```

- **Node.js Express API**: Handles business logic, validation, and routing
- **PostgREST**: Automatically generates REST API from PostgreSQL schema
- **PostgreSQL**: Stores LST data with JSONB support and custom functions

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone and navigate to backend directory
cd backend/nasa-lst-backend

# Start all services
npm run docker:up

# Seed database with sample data
npm run seed

# API available at: http://localhost:3000
# PostgREST available at: http://localhost:3001
# PostgreSQL available at: localhost:5432
```

### Manual Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL and PostgREST (manually or via Docker)
# Update .env with your database credentials

# Start the API server
npm run dev
```

Create a `Dockerfile` for the Node.js application:

```dockerfile
# Dockerfile
FROM node:14

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
```

Create a `docker-compose.yml` file to define the services:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data

  postgrest:
    image: postgrest/postgrest
    environment:
      PGRST_DB_URI: postgres://user:password@postgres/mydb
      PGRST_DB_ANON_ROLE: web_anon
      PGRST_SERVER_PORT: 3001
    depends_on:
      - postgres

  nodejs:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Step 3: Create PostgreSQL Database and Table

Create a SQL script to set up the database schema. Create a file named `init.sql`:

```sql
-- init.sql
CREATE TABLE data_entries (
    id SERIAL PRIMARY KEY,
    xllcorner FLOAT,
    yllcorner FLOAT,
    cellsize FLOAT,
    nrows INT,
    ncols INT,
    band INT,
    units TEXT,
    scale FLOAT,
    latitude FLOAT,
    longitude FLOAT,
    header JSONB,
    subset JSONB
);

CREATE OR REPLACE FUNCTION filter_by_date(start_date DATE, end_date DATE)
RETURNS TABLE(id INT, xllcorner FLOAT, yllcorner FLOAT, cellsize FLOAT, nrows INT, ncols INT, band INT, units TEXT, scale FLOAT, latitude FLOAT, longitude FLOAT, header JSONB, subset JSONB) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM data_entries
    WHERE (subset->>'date')::DATE BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;
```

### Step 4: Create Node.js Application

Create a simple Node.js application. Create a file named `index.js`:

```javascript
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
    user: 'user',
    host: 'postgres',
    database: 'mydb',
    password: 'password',
    port: 5432,
});

app.use(express.json());

app.get('/data', async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        const result = await pool.query('SELECT * FROM filter_by_date($1, $2)', [start_date, end_date]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Node.js app listening at http://localhost:${port}`);
});
```

Create a `package.json` file:

```json
{
  "name": "postgrest-nodejs-backend",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "pg": "^8.7.1"
  }
}
```

### Step 5: Build and Run the Docker Containers

Run the following command to build and start the containers:

```bash
docker-compose up --build
```

### Step 6: Testing the Setup

You can test the setup by inserting some data into the `data_entries` table. You can use a PostgreSQL client or a tool like `pgAdmin` to connect to the database and run the following SQL command:

```sql
INSERT INTO data_entries (xllcorner, yllcorner, cellsize, nrows, ncols, band, units, scale, latitude, longitude, header, subset)
VALUES 
(0, 0, 1, 10, 10, 1, 'meters', 1.0, 45.0, -93.0, '{"info": "header info"}', '[{"date": "2023-01-01", "value": 100}, {"date": "2023-01-02", "value": 200}]');
```

Then, you can query the data using:

```bash
curl "http://localhost:3000/data?start_date=2023-01-01&end_date=2023-01-02"
```

### Conclusion

You now have a Node.js backend project that uses PostgreSQL and PostgREST, all dockerized for behavior-driven development. The JSON structure includes the specified fields, and you have a PostgreSQL procedure for filtering the subset data by date. You can expand this project further by adding more features, such as authentication, more complex queries, or additional endpoints.