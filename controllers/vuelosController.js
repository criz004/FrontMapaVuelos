// controllers/vuelosController.js
const sql = require('mssql');
const config = require('../dbConfig.js');

async function getVuelosEnVivo(req, res) {
    try {
        let pool = await sql.connect(config);
        
        // Consultamos la tabla "Foto en Vivo" que alimenta el Python Monitor
        // Traemos todo para pintar el mapa y mostrar info al hacer click
        let result = await pool.request().query(`
            SELECT 
                HexIdent as id,
                Callsign as callsign,
                Latitud as lat,
                Longitud as lng,
                Rumbo as track,
                Velocidad as speed,
                Altitud as alt,
                Estado as status,
                Squawk as squawk,
                PistaProbable as pista,
                TipoAeronave as tipo,
                Format(HoraAterrizaje, 'yyyy-MM-dd HH:mm:ss') as aterrizaje_time,
                Format(HoraDespegue, 'yyyy-MM-dd HH:mm:ss') as despegue_time,
                Format(UltimaActualizacion, 'yyyy-MM-dd HH:mm:ss') as last_seen
            FROM dbo.EstadoAeropuerto
        `);

        // Devolvemos el JSON al mapa
        res.json(result.recordset);
        
    } catch (error) {
        console.log("❌ Error consultando vuelos: ", error);
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
}

module.exports = {
    getVuelosEnVivo
};