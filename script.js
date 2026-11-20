// Инициализация карты
const map = L.map('map', {
    zoomControl: false,
    minZoom: 2,
    maxZoom: 7,
    maxBoundsViscosity: 1.0,
    bounceAtZoomLimits: false
}).setView([20, 0], 2);

const southWest = L.latLng(-85, -180);
const northEast = L.latLng(85, 180);
map.setMaxBounds(L.latLngBounds(southWest, northEast));

L.control.zoom({ position: 'topleft' }).addTo(map);

let currentGeoJsonLayer = null;
let currentEraData = {}; 

const eraDataFiles = {
    'ivan': 'data_ivan.json',
    'renaissance': 'data_renaissance.json',
    'enlightenment': 'data_enlightenment.json',
    'napoleonic': 'data_napoleonic.json',
    'industrial': 'data_industrial.json'
};

// Генератор уникального цвета для каждой страны
function getColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360; 
    return `hsl(${h}, 60%, 70%)`; 
}

function loadEra(eraName) {
    if (currentGeoJsonLayer) {
        map.removeLayer(currentGeoJsonLayer);
    }

    const dataFile = eraDataFiles[eraName];
    fetch(dataFile)
        .then(res => res.ok ? res.json() : {})
        .then(data => { currentEraData = data; })
        .catch(err => { currentEraData = {}; });

    const geoFiles = {
        'ivan': 'dataivan.geojson/world_1530.geojson', 
        'renaissance': 'datarenaissance.geojson/world_1650.geojson', 
        'enlightenment': 'dataenlightenment.geojson/world_1783.geojson',
        'napoleonic': 'datanapoleonic.geojson/world_1800.geojson',
        'industrial': 'dataindustrial.geojson/world_1900.geojson'
    };

    fetch(geoFiles[eraName])
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки карты');
            return response.json();
        })
        .then(data => {
            let featureIndex = 0;

            currentGeoJsonLayer = L.geoJSON(data, {
                style: function (feature) {
                    const countryName = feature.properties.SUBJECTO || feature.properties.NAME || feature.properties.name || "Unknown";
                    return {
                        color: "#555555",
                        weight: 1,
                        fillColor: getColor(countryName),
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: function (feature, layer) {
                    let countryName = feature.properties.NAME || feature.properties.name || feature.properties.SUBJECTO || "Unknown";
                    
                    featureIndex++;
                    layer.options.className = "country-piece-" + featureIndex;

                    const tooltip = L.tooltip({
                        permanent: true,
                        direction: "center",
                        className: "country-label",
                        opacity: 1
                    }).setContent(countryName);

                    const checkLabel = () => {
                        const bounds = layer.getBounds();
                        const width = bounds.getNorthEast().distanceTo(bounds.getNorthWest());
                        const height = bounds.getNorthEast().distanceTo(bounds.getSouthEast());
                        const currentZoom = map.getZoom();
                        const minSize = currentZoom >= 4 ? 100000 : 1000000; 

                        if (width > minSize && height > minSize) {
                            if (!layer.getTooltip()) layer.bindTooltip(tooltip).openTooltip();
                        } else {
                            if (layer.getTooltip()) layer.unbindTooltip();
                        }
                    };

                    checkLabel();
                    map.on('zoomend', checkLabel);

                    layer.on('mouseover', function (e) {
                        const el = e.target.getElement();
                        if (el) {
                            el.style.stroke = "#f1c40f";
                            el.style.strokeWidth = "3";
                            el.style.fillOpacity = "0.9";
                        }
                    });

                    layer.on('mouseout', function (e) {
                        const el = e.target.getElement();
                        if (el) {
                            el.style.stroke = "#555555";
                            el.style.strokeWidth = "1";
                            el.style.fillOpacity = "0.7";
                        }
                    });

                    layer.on('click', function (e) {
                        L.DomEvent.stopPropagation(e); 
                        showCountryInfo(countryName, feature.properties);
                    });
                }
            }).addTo(map);

            map.fitBounds(currentGeoJsonLayer.getBounds(), { padding: [20, 20] });
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Не удалось загрузить карту. Проверь консоль (F12).');
        });
}

// 🔥 УМНАЯ ФУНКЦИЯ ВЫВОДА ИНФОРМАЦИИ
function showCountryInfo(name, properties) {
    document.getElementById('country-title').innerText = name;
    const infoEl = document.getElementById('country-info');
    
    const searchName = name.replace(/['"`]/g, '').toLowerCase().trim();
    
    let foundKey = Object.keys(currentEraData).find(key => 
        key.replace(/['"`]/g, '').toLowerCase().trim() === searchName
    );
    
    if (!foundKey) {
        foundKey = Object.keys(currentEraData).find(key => {
            const dbKey = key.replace(/['"`]/g, '').toLowerCase().trim();
            return dbKey.slice(0, 5) === searchName.slice(0, 5);
        });
    }

    let data = foundKey ? currentEraData[foundKey] : null;

    if (data) {
        let html = `<p><strong>Правители:</strong><br>${data.rulers}</p>`;
        
        if (data.events && data.events.length > 0) {
            html += `<p><strong>Ключевые события:</strong></p><ul>`;
            data.events.forEach(ev => {
                html += `<li><strong>${ev.year}</strong> — ${ev.event} <span style="color: #7f8c8d;">${ev.result}</span></li>`;
            });
            html += `</ul>`;
        }

        html += `<p><strong>Войны:</strong></p>`;
        if (data.wars && data.wars.length > 0) {
            html += `<ul>`;
            data.wars.forEach(war => {
                html += `
                <li>
                    <strong>${war.name}</strong> (${war.years})<br>
                    <em>Участники:</em> ${war.coalition}<br>
                    <em>Итоги:</em><br>${war.result.replace(/\n/g, '<br>')}
                </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p>Нет данных о войнах.</p>`;
        }

        html += `<p><strong>Расширение границ:</strong><br>${data.expansion}</p>`;
        infoEl.innerHTML = html;
    } else {
        // 🔥 УМНАЯ ЛОГИКА ДЛЯ ТЕРРИТОРИЙ, КОТОРЫХ НЕТ В JSON
        let description = "";
        const lowerName = name.toLowerCase();

        if (lowerName.includes("antarctica") || lowerName.includes("антарктида")) {
            description = "Континент Антарктида не имел коренного населения. Его берега были впервые замечены русской экспедицией Ф. Беллинсгаузена и М. Лазарева только в 1820 году. До этого времени на картах мира на месте Антарктиды часто изображали мифическую 'Неведомую Южную землю' (Terra Australis Incognita). Постоянных поселений здесь никогда не существовало.";
        } else if (lowerName.includes("hunter-gatherer") || lowerName.includes("aboriginal")) {
            description = "Территория проживания племен охотников и собирателей. Эти сообщества вели традиционный образ жизни, не имели единой государственности и письменности. Их культура была основана на гармонии с природой и сезонных миграциях.";
        } else if (lowerName.includes("culture") || lowerName.includes("cultures")) {
            description = "Археологическая культура или группа племен, объединенных общими чертами быта и верований. В данную эпоху они не имели единого государства, но поддерживали торговые и культурные связи с соседями.";
        } else if (lowerName.includes("ocean") || lowerName.includes("sea")) {
            description = "Акватория мирового океана. В данную эпоху эти воды активно исследовались мореплавателями, однако постоянных поселений или государств на воде, естественно, не существовало.";
        } else if (lowerName.includes("unknown") || lowerName.includes("неизвестная") || lowerName.includes("unexplored")) {
            description = "Территория, которая в данную эпоху еще не была полностью исследована европейцами. На картах она часто обозначалась как 'Неизвестная земля'. Здесь могли проживать племенные союзы, не имевшие единого государства с четкими границами.";
        } else {
            description = "На этой территории в данную эпоху не существовало единого централизованного государства. Исторические сведения ограничены археологическими находками или записями соседних народов.";
        }

        infoEl.innerHTML = `
            <div style="background: #eef2f5; padding: 15px; border-left: 5px solid #7f8c8d; border-radius: 5px; margin-bottom: 15px;">
                <p><strong>Историческая справка:</strong></p>
                <p style="line-height: 1.6;">${description}</p>
            </div>
            <p style="font-size: 13px; color: #95a5a6; font-style: italic;">
                (Оригинальное название на карте: ${name})
            </p>
        `;
    }

    document.getElementById('info-modal').classList.remove('hidden');
}

// Обработчики кнопок
document.querySelectorAll('.era-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.era-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        loadEra(e.target.dataset.era);
    });
});

// Закрытие окна
document.querySelector('.close-btn').addEventListener('click', () => {
    document.getElementById('info-modal').classList.add('hidden');
});
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('info-modal')) {
        document.getElementById('info-modal').classList.add('hidden');
    }
});

// Старт
loadEra('ivan');