import express from 'express';
import path from 'path';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import fs from 'fs'; // Librería nativa de Node.js para leer archivos
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


app.use(express.static(__dirname));
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// FUNCIÓN DE BÚSQUEDA INTELIGENTE DENTRO DEL TEXTO DEL PDF OFICIAL
function buscarEnEstatutoReal(consultaUsuario) {
    try {
        // Lee el archivo de texto que guardaste
        const textoCompleto = fs.readFileSync('estatuto.txt', 'utf-8');
        
        // Dividimos el estatuto en párrafos o secciones para no enviarle las 100 páginas de golpe a Gemini
        const lineas = textoCompleto.split('\n');
        const palabrasClave = consultaUsuario.toLowerCase().split(' ').filter(p => p.length > 3);
        
        let bloquesRelevantes = [];
        let bloqueActual = "";

        // Agrupamos el texto en bloques de lectura
        for (let i = 0; i < lineas.length; i++) {
            bloqueActual += lineas[i] + "\n";
            if (i % 15 === 0 || i === lineas.length - 1) { // Bloques de 15 líneas
                bloquesRelevantes.push(bloqueActual);
                bloqueActual = "";
            }
        }

        // Filtramos los bloques que contengan las palabras de la pregunta del estudiante
        let contextoFiltrado = "";
        let coincidencias = 0;

        for (const bloque of bloquesRelevantes) {
            const bloqueMinuscula = bloque.toLowerCase();
            // Si el bloque contiene palabras clave de la consulta, lo añadimos al contexto
            const contienePalabras = palabrasClave.some(palabra => bloqueMinuscula.includes(palabra));
            
            if (contienePalabras) {
                contextoFiltrado += bloque + "\n────────────────────\n";
                coincidencias++;
            }
            // Limitamos los bloques para no saturar el prompt (máximo 6 bloques relevantes)
            if (coincidencias >= 6) break;
        }

        return contextoFiltrado || textoCompleto.substring(0, 5000); // Respaldo del inicio si no hay coincidencia directa
    } catch (error) {
        console.error("Error al leer estatuto.txt:", error);
        return "Error: No se pudo cargar la base de conocimientos oficial.";
    }
}

// ENDPOINT DEL CHAT
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ reply: "Error: El mensaje está vacío." });
    }

    // FILTRO PREVENTIVO SANGRE FRÍA
    const preguntaLimpia = message.toLowerCase();
    const palabrasClaveUasd = [
        'uasd', 'estatuto', 'artículo', 'articulo', 'rector', 'claustro', 'consejo', 
        'estudiante', 'profesor', 'universidad', 'derecho', 'deber', 'sanción', 'sancion', 
        'reglamento', 'organismo', 'facultad', 'academia', 'misión', 'mision', 'visión', 
        'vision', 'autonomía', 'fuente', 'gavel', 'federación', 'fed', 'hola', 'saludos'
    ];

    const esPreguntaValida = palabrasClaveUasd.some(palabra => preguntaLimpia.includes(palabra));

    if (!esPreguntaValida) {
        return res.json({ 
            reply: "Lo siento, soy un asistente exclusivo para el Estatuto Orgánico de la UASD. No puedo responder preguntas sobre otros temas, literatura o cultura general." 
        });
    }

    try {
        // Extrae la información real directamente del archivo oficial extraído
        const contextoLector = buscarEnEstatutoReal(message);

        const systemInstruction = `
            DIAGNÓSTICO CRÍTICO: Eres el Asistente Virtual Oficial de la Universidad Autónoma de Santo Domingo (UASD). Tu sistema operativo está restringido ÚNICAMENTE a leer el texto provisto del Estatuto Orgánico oficial.
            
            REGLA DE IDIOMA MANDATORIA: Debes responder EXCLUSIVAMENTE en idioma español.

            CONTEXTO OFICIAL DEL ESTATUTO (TU ÚNICO UNIVERSO DE CONOCIMIENTO):
            """
            ${contextoLector}
            """

            REGLAS INQUEBRANTABLES DE OPERACIÓN:
            1. Tu única fuente de verdad es el texto de arriba, el cual proviene directamente del PDF institucional (https://postgrado.uasd.edu.do/wp-content/uploads/2024/06/ESTATUTO-ORGANICO-UASD.pdf).
            
            2. Si la respuesta exacta a la consulta del usuario no se puede deducir de forma clara del CONTEXTO OFICIAL provisto, debes responder estrictamente: 
               "Lo siento, no tengo información suficiente en el Estatuto Orgánico para responder a esa consulta."
            
            3. No inventes artículos, números, fechas ni atribuciones que no estén escritos de manera explícita en las comillas triples.
            
            4. Responde de forma clara, coherente, breve y con un tono formal e institucional.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.0 // Cero creatividad para evitar alucinaciones
            }
        });

        res.json({ reply: response.text });

    } catch (error) {
        console.error("Error en el módulo de IA:", error);
        res.status(500).json({ reply: "Hubo un error interno al procesar tu consulta con la IA." });
    }
});
function initListeners() {
    // Escuchar el botón físico de enviar
    sendBtn.addEventListener('click', handleSendInput);

    // Escuchar la tecla Enter
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendInput();
    });

    // Escuchar los clics en absolutamente cualquier botón de sugerencia del nuevo listado
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const promptText = btn.getAttribute('data-prompt');
            if (promptText) processUserMessage(promptText);
        });
    });
}

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor de IA corriendo en http://localhost:${PORT}`);
});