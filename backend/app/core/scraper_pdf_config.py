# Configuramos si vemos el navegador o no para cambiarlo solo teenemos que poner en lugar de False True
HEADLESS_MODE = False
MAX_PROFILES_PER_SEARCH = 10

# Sectores orfanizados en un diccionario para iterar sobre ellos de manera más fácil
SECTORES_KEYWORDS = {
    "SECTOR LEGAL": ["Abogado", "Asesor Jurídico", "Paralegal", "Compliance", "Derecho Corporativo"],
    "SECTOR FINANCIERO Y BANCA": ["Contable", "Analista Financiero", "Director Financiero", "Gestor de Banca", "Auditor"],
    "SECTOR SEGUROS": ["Agente de Seguros", "Actuario", "Tramitador de Siniestros", "Perito", "Mediador"],
    "SECTOR TECNOLÓGICO": ["Desarrollador", "Programador", "Backend", "Frontend", "Data Scientist", "Ingeniero de Software"], # Listo para cuando hagamos GitHub
    "SECTOR VENTAS": ["Comercial", "Ejecutivo de Ventas", "Key Account Manager", "Business Development", "Jefe de Ventas"],
    "SECTOR SERVICIOS": ["Atención al Cliente", "Recepcionista", "Gestor de Servicios", "Soporte Técnico"],
    "SECTOR LOGÍSTICA": ["Jefe de Almacén", "Supply Chain", "Mozo de Almacén", "Operador Logístico", "Gestor de Flotas"],
    "SECTOR INGENIERÍA": ["Ingeniero Industrial", "Ingeniero Civil", "Jefe de Obra", "Proyectista", "Ingeniero Mecánico"]
}

# Lugar donde realizar la busqueda se pueden buscar en más sitios, solo habria que añadirlos 
LOCATIONS = ["España"]
