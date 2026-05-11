import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_AI_KEY"))

async def parse_with_gemini(raw_text: str) -> dict:
    """
    Recibe el texto bruto de un documento (PDF o web) y usa Gemini para extraer y estructurar los datos en formato JSON
    """
    print("Analizando el texto del candidato")
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    Eres un experto reclutador de Recursos Humanos. Tu única tarea es extraer la información 
    del siguiente texto de un currículum o perfil profesional y devolverla ESTRICTAMENTE 
    en formato JSON válido.
    
    REGLAS CRÍTICAS:
    1. No incluyas texto adicional, ni saludos, ni explicaciones.
    2. Devuelve SOLO el objeto JSON.
    3. Si un dato no existe en el texto, devuelve un string vacío "".

    ESTRUCTURA JSON REQUERIDA:
    {{
        "first_name": "Nombre",
        "last_name": "Apellidos",
        "email": "Correo electrónico",
        "phone": "Teléfono",
        "location": "Ciudad o País",
        "experience": "Resumen de experiencia",
        "education": "Extrae TODA la formación académica, titulaciones Y TAMBIÉN LOS IDIOMAS con su nivel. Júntalo todo aquí de forma limpia. NO lo dejes vacío si hay estudios o idiomas en el texto.",
        "skills": "Tecnologías y habilidades blandas."
    }}

    TEXTO A ANALIZAR:
    {raw_text}
    """
    
    try: 
        response = await model.generate_content_async(prompt)
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        
        candidato_data = json.loads(clean_json)
        print("Análisis de IA completado con exito")
        return candidato_data
    
    except json.JSONDecodeError as e:
        print(f"Error de formato JSON desde Gemini: {e}")
        return _datos_por_defecto(raw_text)    
    
    except Exception as e:
        print(f"Error conectando a Gemini: {e}")
        return _datos_por_defecto(raw_text)
    
def _datos_por_defecto(raw_text: str) -> dict:
    """
    Función de rescate, si Gemini falla, guardamos el texto en experience para no perder el CV del candidato
    """
    
    return {
        "first_name": "Candidato",
        "last_name": "(Revisar Manualmente)",
        "email": "",
        "phone": "",
        "location": "España",
        "experience": raw_text[:800],
        "education": "Revisar CV original",
        "skills": ""
    }
    