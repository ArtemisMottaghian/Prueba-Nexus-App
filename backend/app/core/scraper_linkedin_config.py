# Palabras clave que el scraper va a buscar en InfoJobs
JOB_KEYWORDS = [
    #"Tecnología",
    "Software", #"IT", #"Ciberseguridad",
    #"Ingeniería", "Engineering",
    #"Finanzas", "Banca", "Banking",
    #"Legal", "Abogado", "Jurídico",
    #"Ventas", "Comercial", "Sales",
    #"Logística", "Supply Chain", "Almacén",
    #"Servicios", "Atención al cliente",
    #"Seguros", "Insurance"
]

PAGES = 1
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