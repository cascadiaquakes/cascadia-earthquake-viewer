import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const port = 3002;

// PostgreSQL connection
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    host: process.env.PGHOST || 'postgis-eq',  // CHANGED
    port: process.env.PGPORT || 5432,           // CHANGED
    database: process.env.PGDATABASE || 'gis'
});

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Get list of available catalogs
app.get('/api/catalogs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                catalog_id, 
                catalog_name, 
                doi, 
                technique, 
                network_codes, 
                region, 
                num_events,
                publication_title,
                start_date::text as start_date,
                end_date::text as end_date,
                submitted_by,
                submission_date::text as submission_date,
                status,
                metadata
            FROM earthquake.catalogs
            WHERE status = 'active'
            ORDER BY catalog_id
        `);
        res.json({ catalogs: result.rows });
    } catch (error) {
        console.error('Error fetching catalogs:', error);
        res.status(500).json({ error: 'Failed to fetch catalogs' });
    }
})

// Get earthquakes with filters
app.get('/api/earthquakes', async (req, res) => {
    try {
        const {
            catalog = 1,
            limit = 10000,
            minDepth = 0,
            maxDepth = 100,
            minMagnitude,
            maxMagnitude,
            startDate,
            endDate,
            minLat,
            maxLat,
            minLon,
            maxLon,
            maxHorizontalError,
            maxVerticalError,
            includeMissingUncertainty = 'true'  // Default to include missing
        } = req.query;

        // Build dynamic WHERE clause
        let whereConditions = [
            'catalog_id = $1',
            'depth >= $2',
            'depth <= $3'
        ];
        let values = [catalog, minDepth, maxDepth];
        let paramCounter = 4;

        // Add magnitude filter if provided (only if not default range)
        if (minMagnitude && parseFloat(minMagnitude) > 0) {
            whereConditions.push(`magnitude >= $${paramCounter}`);
            values.push(minMagnitude);
            paramCounter++;
        }
        if (maxMagnitude && parseFloat(maxMagnitude) < 10) {
            whereConditions.push(`magnitude <= $${paramCounter}`);
            values.push(maxMagnitude);
            paramCounter++;
        }

        // Add date range filter
        if (startDate) {
            whereConditions.push(`origin_time >= $${paramCounter}`);
            values.push(startDate);
            paramCounter++;
        }
        if (endDate) {
            whereConditions.push(`origin_time <= $${paramCounter}`);
            values.push(endDate);
            paramCounter++;
        }

        // Add spatial bounding box filter using PostGIS geometry
        if (minLat) {
            whereConditions.push(`ST_Y(geom) >= $${paramCounter}`);
            values.push(minLat);
            paramCounter++;
        }
        if (maxLat) {
            whereConditions.push(`ST_Y(geom) <= $${paramCounter}`);
            values.push(maxLat);
            paramCounter++;
        }
        if (minLon) {
            whereConditions.push(`ST_X(geom) >= $${paramCounter}`);
            values.push(minLon);
            paramCounter++;
        }
        if (maxLon) {
            whereConditions.push(`ST_X(geom) <= $${paramCounter}`);
            values.push(maxLon);
            paramCounter++;
        }

        // Add horizontal error filter
        if (maxHorizontalError && parseFloat(maxHorizontalError) < 100) {
            const includeNull = includeMissingUncertainty === 'true';
            if (includeNull) {
                whereConditions.push(`(horizontal_error_km IS NULL OR horizontal_error_km <= $${paramCounter})`);
            } else {
                whereConditions.push(`(horizontal_error_km IS NOT NULL AND horizontal_error_km <= $${paramCounter})`);
            }
            values.push(maxHorizontalError);
            paramCounter++;
        }

        // Add vertical error filter
        if (maxVerticalError && parseFloat(maxVerticalError) < 100) {
            const includeNull = includeMissingUncertainty === 'true';
            if (includeNull) {
                whereConditions.push(`(vertical_error_km IS NULL OR vertical_error_km <= $${paramCounter})`);
            } else {
                whereConditions.push(`(vertical_error_km IS NOT NULL AND vertical_error_km <= $${paramCounter})`);
            }
            values.push(maxVerticalError);
            paramCounter++;
        }

        const whereClause = whereConditions.join(' AND ');
        values.push(limit);

        const query = `
            SELECT 
                evid, 
                ST_X(geom) as longitude, 
                ST_Y(geom) as latitude,
                depth, 
                origin_time, 
                magnitude,
                magnitude_type,
                nsta, 
                gap, 
                horizontal_error_km,
                vertical_error_km,
                rms,
                region
            FROM earthquake.events
            WHERE ${whereClause}
            ORDER BY RANDOM()
            LIMIT $${paramCounter}
        `;

        const result = await pool.query(query, values);

        res.json({
            count: result.rows.length,
            earthquakes: result.rows
        });

    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Database query failed' });
    }
});


app.listen(port, () => {
    console.log(`Earthquake API running on http://localhost:${port}`);
});