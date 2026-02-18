const ENDPOINT = "http://localhost:3001/api/vuelos-live"; // Asegúrate que el puerto sea correcto

// --- CONFIGURACIÓN DEL MAPA ---
// Inicializamos el mapa centrado en el AICM con un zoom adecuado
const map = L.map('map', {
    zoomControl: false, // Ocultamos los controles por defecto para un look más limpio
    attributionControl: false
}).setView([19.4361, -99.0719], 13);

// Capa de tiles (Mapa base oscuro de CartoDB para que resalten los aviones)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
}).addTo(map);

// Capa donde guardaremos los marcadores de los aviones
let capaMarcadores = L.layerGroup().addTo(map);

// --- LÓGICA DE LA BARRA REDIMENSIONABLE (RESIZER) ---
const resizer = document.getElementById('resizer');
const leftPanel = document.getElementById('map-panel');
const rightPanel = document.getElementById('table-panel');
const container = document.querySelector('.main-container');

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize'; // Cambia el cursor en todo el body
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Calcula el nuevo ancho basado en la posición del mouse
    // Restamos el offset del contenedor principal por si hay márgenes
    const containerOffsetLeft = container.getBoundingClientRect().left;
    const newWidth = e.clientX - containerOffsetLeft;

    // Establece límites para que no se colapse ninguno de los paneles
    const minWidthLeft = 300;
    const minWidthRight = 300;
    const maxWidth = container.clientWidth - minWidthRight;

    if (newWidth > minWidthLeft && newWidth < maxWidth) {
        leftPanel.style.flexBasis = `${newWidth}px`;
        // Importante: Invalidar el tamaño del mapa para que Leaflet se reajuste
        map.invalidateSize(); 
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    resizer.classList.remove('resizing');
    document.body.style.cursor = 'default';
    map.invalidateSize(); // Asegura un último ajuste
});


// --- ACTUALIZAR HORA ---
function actualizarFechaHora() {
    const ahora = new Date();
    // Formato de fecha y hora personalizado
    const opciones = { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false // Usa formato 24 horas
    };
    document.getElementById('fecha-hora').textContent = ahora.toLocaleString('es-MX', opciones).replace(',', '');
}
setInterval(actualizarFechaHora, 1000);
actualizarFechaHora();

// --- DEFINICIÓN DE ICONO DE AVIÓN ---
function getIconoAvion() {
    // Ruta al icono del avión. Asegúrate de que la imagen exista en public/imgMapaVuelos/
    const iconoUrl = 'imgMapaVuelos/avion.png'; 
    
    return L.icon({
        iconUrl: iconoUrl,
        iconSize: [24, 24], // Tamaño del icono
        iconAnchor: [12, 12], // Punto central del icono para la rotación
        popupAnchor: [0, -12] // Donde aparece el popup relativo al icono
    });
}

// --- LÓGICA PRINCIPAL: CARGAR Y MOSTRAR DATOS ---
async function cargarVuelos() {
    try {
        const res = await fetch(ENDPOINT);
        const vuelos = await res.json();

        // console.log(`📡 Datos recibidos: ${vuelos.length} vuelos`);

        // 1. Limpiar datos anteriores
        capaMarcadores.clearLayers();
        const listaOperaciones = document.getElementById('operaciones-list');
        listaOperaciones.innerHTML = '';

        // 2. Procesar cada vuelo recibido
        vuelos.forEach(v => {
            // --- A) PINTAR EN MAPA ---
            if (v.lat && v.lng) {
                // Determinamos el color del texto del popup según el estado
                let colorTexto = "#ffffff";
                if (v.status === 'EMERGENCIA' || v.status === 'SECUESTRO') colorTexto = "#ff4444";
                if (v.status === 'EN_TIERRA') colorTexto = "#ffc107";

                // Creamos el marcador. ¡AQUÍ ES CLAVE 'rotationAngle'!
                // Debe coincidir con la propiedad 'track' o 'rumbo' de tu JSON.
                // Si tu backend envía 'rumbo' en lugar de 'track', cámbialo aquí.
                const rotation = v.track || v.rumbo || 0; 

                const marker = L.marker([v.lat, v.lng], {
                    icon: getIconoAvion(),
                    rotationAngle: rotation, // Usa el plugin leaflet-rotatedmarker
                    rotationOrigin: 'center center'
                });

                // Popup con información detallada al hacer clic
                marker.bindPopup(`
                    <div style="text-align:left; color:#333;">
                        <b style="color:${colorTexto}; font-size:1.1em;">${v.callsign || v.id}</b><br>
                        <hr style="margin: 5px 0;">
                        <b>Estado:</b> ${v.status}<br>
                        <b>Altitud:</b> ${v.alt} ft<br>
                        <b>Velocidad:</b> ${v.speed} kts<br>
                        <b>Rumbo:</b> ${rotation}°<br>
                        <b>Pista/Ubicación:</b> ${v.pista || 'Sin asignar'}<br>
                        <b>Squawk:</b> ${v.squawk || 'N/A'}
                    </div>
                `);

                marker.addTo(capaMarcadores);
            }

            // --- B) LLENAR TABLA DE OPERACIONES ---
            // Creamos la fila (li) con la estructura flexible
            const li = document.createElement('li');
            
            // Determinamos la clase CSS para el color del estado
            let estadoClass = 'estado-vuelo';
            if (v.status === 'EN_TIERRA') estadoClass = 'estado-tierra';
            if (v.status === 'EMERGENCIA' || v.status === 'SECUESTRO' || v.status === 'FALLA_RADIO') estadoClass = 'estado-emergencia';

            // Formateamos la hora del último evento relevante
            let horaEvento = v.last_seen;
            // Priorizamos hora de aterrizaje o despegue si aplica
            if(v.status === 'EN_TIERRA' && v.aterrizaje_time) horaEvento = v.aterrizaje_time;
            if(v.status === 'EN_VUELO' && v.despegue_time) horaEvento = v.despegue_time;
            
            // Extraemos solo la parte de la hora (HH:MM:SS) si existe
            horaEvento = horaEvento ? horaEvento.split(' ')[1] : '--:--:--';

            // Insertamos las celdas (spans) con los estilos flexibles
            li.innerHTML = `
                <span class="td ${estadoClass}" style="flex: 1;">${v.status}</span>
                <span class="td" style="flex: 0.8;">${v.id}</span>
                <span class="td" style="font-weight:bold; flex: 1;">${v.callsign || 'N/A'}</span>
                <span class="td" style="flex: 1.2;">${v.pista || '--'}</span>
                <span class="td" style="flex: 0.8;">${horaEvento}</span>
            `;
            listaOperaciones.appendChild(li);
        });

    } catch (error) {
        console.error("❌ Error al cargar vuelos:", error);
        // Opcional: Mostrar un mensaje de error en la tabla
    }
}

// Iniciar la carga de datos y establecer el intervalo de actualización
cargarVuelos();
// Actualizar cada 1.5 segundos para un movimiento más fluido
setInterval(cargarVuelos, 1500);