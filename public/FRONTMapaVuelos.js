const ENDPOINT = "http://172.17.18.25:3001/api/vuelos-live"; // Asegúrate del puerto!

const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([19.4361, -99.0719], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
}).addTo(map);

let capaMarcadores = L.layerGroup().addTo(map);

// --- ESTADOS DE LA INTERFAZ ---
let hexSeleccionado = null; // Recuerda qué avión estamos viendo en el panel
let mostrarEtiquetas = false; // Estado del botón de etiquetas

// --- CONTROLES DE INTERFAZ ---
// Botón de etiquetas
document.getElementById('toggle-labels').addEventListener('click', (e) => {
    mostrarEtiquetas = !mostrarEtiquetas;
    e.target.classList.toggle('active', mostrarEtiquetas);
    cargarVuelos(); // Forzamos redibujado instantáneo
});

// Barra redimensionable (Resizer)
const resizer = document.getElementById('resizer');
const leftPanel = document.getElementById('map-panel');
const container = document.querySelector('.main-container');
let isResizing = false;

resizer.addEventListener('mousedown', () => { isResizing = true; resizer.classList.add('resizing'); document.body.style.cursor = 'col-resize'; });
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX - container.getBoundingClientRect().left;
    if (newWidth > 300 && newWidth < container.clientWidth - 300) {
        leftPanel.style.flexBasis = `${newWidth}px`;
        map.invalidateSize(); 
    }
});
document.addEventListener('mouseup', () => { isResizing = false; resizer.classList.remove('resizing'); document.body.style.cursor = 'default'; map.invalidateSize(); });

// --- CONFIGURACIÓN DINÁMICA DE COLUMNAS ---
const COLUMNAS = [
    { id: 'status', label: 'Estado', flex: 1, visible: true },
    { id: 'hex', label: 'Hex', flex: 0.8, visible: true },
    { id: 'callsign', label: 'Vuelo', flex: 1, visible: true },
    { id: 'pista', label: 'Pista', flex: 1.2, visible: true },
    { id: 'hora', label: 'Evento', flex: 0.8, visible: true }, // Hora combinada
    { id: 'alt', label: 'Altitud', flex: 0.8, visible: false },
    { id: 'speed', label: 'Veloc.', flex: 0.8, visible: false },
    { id: 'track', label: 'Rumbo', flex: 0.6, visible: false },
    { id: 'squawk', label: 'Squawk', flex: 0.8, visible: false },
    { id: 'aterrizaje', label: 'H. Aterr.', flex: 0.9, visible: false },
    { id: 'despegue', label: 'H. Desp.', flex: 0.9, visible: false }
];

// --- INICIALIZAR MENÚ DE COLUMNAS ---
function initColumnas() {
    const menu = document.getElementById('menu-columnas');
    
    // Crear checkboxes
    COLUMNAS.forEach((col, index) => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" data-index="${index}" ${col.visible ? 'checked' : ''}> ${col.label}`;
        
        // Evento al marcar/desmarcar
        label.querySelector('input').addEventListener('change', (e) => {
            COLUMNAS[e.target.dataset.index].visible = e.target.checked;
            renderHeaders();
            cargarVuelos(); // Forzar actualización de la tabla
        });
        menu.appendChild(label);
    });

    // Abrir/Cerrar menú
    document.getElementById('btn-columnas').addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });

    // Cerrar menú si haces clic fuera de él
    document.addEventListener('click', (event) => {
        const isClickInside = document.querySelector('.dropdown').contains(event.target);
        if (!isClickInside) {
            menu.classList.add('hidden');
        }
    });

    renderHeaders(); // Dibujar encabezados iniciales
}

// Dibuja los <span> de los títulos según lo que esté visible
function renderHeaders() {
    const header = document.getElementById('tabla-header');
    header.innerHTML = '';
    COLUMNAS.forEach(col => {
        if (col.visible) {
            header.innerHTML += `<span class="th" style="flex: ${col.flex};">${col.label}</span>`;
        }
    });
}

// Reloj
function actualizarFechaHora() {
    document.getElementById('fecha-hora').textContent = new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');
}
setInterval(actualizarFechaHora, 1000); actualizarFechaHora();

function getIconoAvion(isSelected, status, tipo) {
    let clasesStr = 'icono-avion-filtro';
    let isEmergency = (status === 'EMERGENCIA' || status === 'SECUESTRO' || status === 'FALLA_RADIO');
    
    // Lógica de colores (El hack mágico)
    if (isEmergency && isSelected) {
        clasesStr += ' avion-emergencia-seleccionado';
    } else if (isEmergency && !isSelected) {
        clasesStr += ' avion-emergencia';
    } else if (!isEmergency && isSelected) {
        clasesStr += ' avion-seleccionado';
    }

    // Lógica de formas (Tipos de aeronave)
    let urlImagen = 'imgMapaVuelos/avion.svg'; // Comercial por defecto
    if (tipo === 'HELICOPTERO') urlImagen = 'imgMapaVuelos/helicoptero.svg';
    if (tipo === 'MILITAR') urlImagen = 'imgMapaVuelos/militar.svg';
    if (tipo === 'CARGO') urlImagen = 'imgMapaVuelos/cargo.svg';
    if (tipo === 'LIGERO') urlImagen = 'imgMapaVuelos/ligero.svg';

    return L.icon({
        iconUrl: urlImagen, 
        iconSize: [28, 28],   
        iconAnchor: [14, 14], 
        className: clasesStr 
    });
}

// Actualiza los textos del recuadro inferior derecho
function actualizarPanelDetalles(v) {
    const panel = document.getElementById('flight-details');
    panel.classList.remove('hidden'); // Mostrar panel
    
    let colorTexto = "#ffffff";
    if (v.status === 'EMERGENCIA' || v.status === 'SECUESTRO') colorTexto = "#ff4444";
    if (v.status === 'EN_TIERRA') colorTexto = "#ffc107";

    const titulo = document.getElementById('det-callsign');
    titulo.textContent = v.callsign ? v.callsign.trim() : 'N/A';
    titulo.style.color = colorTexto;

    document.getElementById('det-hex').textContent = v.id;
    document.getElementById('det-status').textContent = v.status;
    document.getElementById('det-alt').textContent = v.alt !== null ? v.alt : '--';
    document.getElementById('det-spd').textContent = v.speed !== null ? v.speed : '--';
    document.getElementById('det-track').textContent = v.track !== null ? v.track : '--';
    document.getElementById('det-pista').textContent = v.pista || '--';
    document.getElementById('det-squawk').textContent = v.squawk || '--';
}

async function cargarVuelos() {
    try {
        const res = await fetch(ENDPOINT);
        const vuelos = await res.json();

        capaMarcadores.clearLayers();
        const listaOperaciones = document.getElementById('operaciones-list');
        listaOperaciones.innerHTML = '';

        // Variable para verificar si el avión seleccionado sigue existiendo
        let avionSeleccionadoSigueVivo = false;

        vuelos.forEach(v => {
            // --- PINTAR EN MAPA ---
            if (v.lat && v.lng) {
                const rotation = v.track || v.rumbo || 0; 
                
                // ¿Es este el avión que el usuario tiene seleccionado?
                const isSelected = (hexSeleccionado === v.id);

                const marker = L.marker([v.lat, v.lng], {
                    icon: getIconoAvion(isSelected, v.status, v.tipo),
                    rotationAngle: rotation, 
                    rotationOrigin: 'center center',
                    // Hacemos que el avión seleccionado siempre flote por encima del resto
                    zIndexOffset: isSelected ? 1000 : 0 
                });

                // --- ETIQUETAS (LABELS) ---
                if (mostrarEtiquetas) {
                    const textoEtiqueta = v.callsign ? v.callsign.trim() : v.id;
                    marker.bindTooltip(textoEtiqueta, {
                        permanent: true, 
                        direction: 'top', 
                        className: 'flight-label', 
                        offset: [0, -18] // Lo subimos un poco más porque el avión creció
                    });
                }

                // --- CLIC EN EL AVIÓN ---
                marker.on('click', () => {
                    hexSeleccionado = v.id; 
                    actualizarPanelDetalles(v);
                    cargarVuelos(); // <--- Forzamos actualización para ver el resplandor instantáneamente
                });

                if (hexSeleccionado === v.id) {
                    actualizarPanelDetalles(v);
                    avionSeleccionadoSigueVivo = true;
                }

                marker.addTo(capaMarcadores);
            }

            // --- LLENAR TABLA (MODIFICADO PARA COLUMNAS DINÁMICAS) ---
            const li = document.createElement('li');
            
            // Colores de estado
            let estadoClass = 'estado-vuelo';
            if (v.status === 'EN_TIERRA') estadoClass = 'estado-tierra';
            if (v.status === 'EMERGENCIA' || v.status === 'SECUESTRO' || v.status === 'FALLA_RADIO') estadoClass = 'estado-emergencia';

            // Formatear las horas para que no sean un string gigante
            let horaAterrizaje = v.aterrizaje_time ? v.aterrizaje_time.split(' ')[1] : '--:--:--';
            let horaDespegue = v.despegue_time ? v.despegue_time.split(' ')[1] : '--:--:--';
            
            let horaEvento = v.last_seen;
            if(v.status === 'EN_TIERRA' && v.aterrizaje_time) horaEvento = v.aterrizaje_time;
            if(v.status === 'EN_VUELO' && v.despegue_time) horaEvento = v.despegue_time;
            horaEvento = horaEvento ? horaEvento.split(' ')[1] : '--:--:--';

            // Diccionario con los datos reales de este avión
            const datosFila = {
                status: `<span class="${estadoClass}">${v.status}</span>`,
                hex: v.id,
                callsign: `<span style="font-weight:bold;">${v.callsign || 'N/A'}</span>`,
                pista: v.pista || '--',
                hora: horaEvento,
                alt: v.alt !== null ? `${v.alt}` : '--',
                speed: v.speed !== null ? `${v.speed}` : '--',
                track: v.track !== null ? `${v.track}°` : '--',
                squawk: v.squawk || '--',
                aterrizaje: horaAterrizaje,
                despegue: horaDespegue
            };

            // Construir el HTML de la fila SOLO con las columnas visibles
            let rowHTML = '';
            COLUMNAS.forEach(col => {
                if (col.visible) {
                    rowHTML += `<span class="td" style="flex: ${col.flex};">${datosFila[col.id]}</span>`;
                }
            });
            li.innerHTML = rowHTML;
            
            // Evento click en la fila de la tabla
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                hexSeleccionado = v.id;
                actualizarPanelDetalles(v);
                map.panTo([v.lat, v.lng]); 
                cargarVuelos(); // <--- Aplica el resplandor al instante
            });

            listaOperaciones.appendChild(li);
        });

        // Si el avión que estábamos viendo desapareció del radar, ocultamos el panel
        if (hexSeleccionado && !avionSeleccionadoSigueVivo) {
            document.getElementById('flight-details').classList.add('hidden');
            hexSeleccionado = null;
        }

    } catch (error) {
        console.error("❌ Error al cargar vuelos:", error);
    }
}

initColumnas();
cargarVuelos();
setInterval(cargarVuelos, 1500);