# Palabras clave que el scraper va a buscar en InfoJobs
JOB_KEYWORDS = [
    # Tech / IT
    "Tecnología", "Technology",
    "Software",
    "IT",
    "Desarrollador", "Developer",
    "Programador", "Programmer",
    "Backend",
    "Frontend",
    "Full Stack",
    "Data Engineer",
    "Data Analyst", "Analista de Datos",
    "Machine Learning",
    "Inteligencia Artificial", "Artificial Intelligence",
    "Ciberseguridad", "Cybersecurity",
    "DevOps",
    "SAP",
    "Sistemas", "IT Systems",
    "Cloud",
    "Arquitecto de Software", "Software Architect",

    # Ingeniería
    "Ingeniería", "Ingeniero", "Engineering", "Engineer",

    # Finanzas y Banca
    "Finanzas", "Finance",
    "Banca", "Banking",

    # Legal
    "Legal", "Abogado", "Jurídico",

    # Ventas y Comercial
    "Ventas", "Comercial", "Sales",

    # Logística
    "Logística", "Supply Chain", "Almacén",

    # Servicios
    "Servicios", "Atención al cliente",

    # RRHH
    "Recursos Humanos", "Human Resources",

    # Seguros
    "Seguros", "Insurance",
]

PAGES = 2
MAX_DAYS_OLD = 14

INFOJOBS_HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'es-ES,es;q=0.7',
    'portalid': '0',
    'priority': 'u=1, i',
    'referer': 'https://www.infojobs.net/jobsearch/search-results/list.xhtml',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    'x-adevinta-channel': 'web',
    'x-schibsted-tenant': 'infojobs'
}