import re

async def parse_with_code(raw_text: str) -> dict:
    """
    Procesador 100% código puro sin IA.
    Utiliza Expresiones Regulares mejoradas y borrado de huellas.
    """
    print("⚙️ Analizando el texto del candidato con Algoritmo de Código Puro...")
    
    text_clean = raw_text.replace('\r', '\n')
    
    # 1. EXTRACCIÓN EXACTA (Expresiones Regulares a prueba de balas)
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    # Regex mejorada: Pilla el +34 (opcional) y luego 9 dígitos sin importar dónde estén los espacios o guiones
    phone_pattern = r'(?:\+34|0034)?[\s\-]*[6789](?:[\s\-]*\d){8}'
    
    email_match = re.search(email_pattern, text_clean)
    phone_match = re.search(phone_pattern, text_clean)
    
    email_val = email_match.group(0).lower() if email_match else ""
    phone_val = phone_match.group(0).strip() if phone_match else ""
    
    # 🔥 TRUCO MAGICO: Borramos el email y el teléfono del texto principal 
    # para que no se cuelen luego en los bloques de Educación o Experiencia
    text_sin_datos_contacto = text_clean
    if email_match:
        text_sin_datos_contacto = text_sin_datos_contacto.replace(email_match.group(0), "")
    if phone_match:
        text_sin_datos_contacto = text_sin_datos_contacto.replace(phone_match.group(0), "")

    # 2. EXTRACCIÓN DEL NOMBRE
    lines = [line.strip() for line in text_sin_datos_contacto.split('\n') if line.strip() and len(line.strip()) > 2]
    first_name = "Candidato"
    last_name = ""
    
    if lines:
        parts = lines[0].split(maxsplit=1)
        first_name = parts[0].capitalize()
        if len(parts) > 1:
            if "curriculum" not in parts[1].lower() and "cv" not in parts[1].lower():
                last_name = parts[1].title()

    # 3. EXTRACCIÓN DE BLOQUES
    text_upper = text_sin_datos_contacto.upper()
    
    exp_kw = ["EXPERIENCIA", "TRAYECTORIA", "HISTORIAL LABORAL", "EXPERIENCE"]
    edu_kw = ["EDUCACIÓN", "EDUCACION", "FORMACIÓN", "FORMACION", "ESTUDIOS", "ACADÉMICA", "EDUCATION"]
    skills_kw = ["HABILIDADES", "SKILLS", "CONOCIMIENTOS", "COMPETENCIAS", "TECNOLOGÍAS", "APTITUDES", "IDIOMAS"]
    
    all_kw = exp_kw + edu_kw + skills_kw

    def extract_section(start_keywords, all_keywords, text_upper, text_original):
        start_idx = -1
        for kw in start_keywords:
            idx = text_upper.find(kw)
            if idx != -1:
                if start_idx == -1 or idx < start_idx:
                    start_idx = idx
                    
        if start_idx == -1:
            return ""
            
        end_idx = len(text_upper)
        for kw in all_keywords:
            if kw not in start_keywords:
                idx = text_upper.find(kw, start_idx + 10) 
                if idx != -1 and idx < end_idx:
                    end_idx = idx
                    
        seccion_cruda = text_original[start_idx:end_idx].strip()
        seccion_limpia = re.sub(r'\s*\n\s*', ', ', seccion_cruda)
        return seccion_limpia

    experience = extract_section(exp_kw, all_kw, text_upper, text_sin_datos_contacto)
    education = extract_section(edu_kw, all_kw, text_upper, text_sin_datos_contacto)
    skills = extract_section(skills_kw, all_kw, text_upper, text_sin_datos_contacto)

    # 4. CONSTRUCCIÓN DEL JSON FINAL
    print("✅ Extracción por código finalizada")
    return {
        "first_name": first_name,
        "last_name": last_name if last_name else "(Extraído sin IA)",
        "email": email_val,
        "phone": phone_val,
        "location": "España",
        "experience": experience[:2000] if experience else "",
        "education": education[:1000] if education else "",
        "skills": skills[:500] if skills else ""
    }