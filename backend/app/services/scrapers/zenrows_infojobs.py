import asyncio
import httpx
from core.config import settings
from sqlalchemy.dialects.postgresql import insert
from backend.app.schemas.job_offer import JobOfferRequest

from bs4 import BeautifulSoup
import re
import json
import urllib.parse


# -----------
# MAPA SECTORES
# -----------
SECTORES ={ 
    "Administración de empresas": 10,
    "Administración pública": 20,
    "Atencion al cliente": 170,
    "Calidad, produccion e I+D": 30,
    "Comercial y ventas": 190,
    "Compras, logística y almacen": 40,
    "Diseño y artes gráficas": 50,
    "Educación y formación": 60,
    "Finanzas y banca": 70,
    "Informática y telecomunicaciones": 150,
    "Ingenieros y técnicos": 80,
    "Inmobiliaria y construcción": 90,
    "Legal": 100,
    "Marketing": 110,
    "Otros": 180,
    "Profesiones, artes y oficios": 120,
    "Recursos humanos": 130,
    "Sanidad y salud": 140,
    "Sector faramaceutico": 210,
    "Turismo y restauración": 160,
    "Ventas al detalle": 200
    }

# -----------
#PARAMETROS BUSQUEDA
busqueda_actual = "desarrollador"
ciudad_actual = "madrid"  # None para toda España
paginas_a_escanear = 2
horas_historico = 24  # Opciones: 24, 48, 72 o None
sector_buscar = "Informática y telecomunicaciones"
# ------------------------------

# -----------
# FUNCION CONSTRUCCION URL
# -----------
def construir_url_infojobs(palabra_clave=None, provincia=None, pagina=1, filtro_horas=None, id_sector=None):
    #  URL base
    url_base = "https://www.infojobs.net/ofertas-trabajo"
    
    # Provincia y/o Palabra clave
    if provincia:
        url_base += f"/{provincia.lower().replace(' ', '-')}"
    if palabra_clave:
        url_base += f"/{palabra_clave.lower().replace(' ', '-')}"

    # parametros busqueda usamos una lista para unirlos 
    params_lista = [f"page={pagina}", "sortBy=PUBLICATION_DATE"]
    
    #palabra clave
    if palabra_clave:
        params_lista.append(f"keyword={urllib.parse.quote(palabra_clave)}")
    
    # Sector
    if id_sector:
        params_lista.append(f"categoryIds={id_sector}")

    #filtro horas  
    if filtro_horas == 24:
        params_lista.append("sinceDate=_24_HOURS")
    elif filtro_horas == 48:
        params_lista.append("sinceDate=_48_HOURS")
    elif filtro_horas == 72:
        params_lista.append("sinceDate=_72_HOURS")
    else:
        params_lista.append("sinceDate=ANY")

    # Unimos todos los parámetros con '&' y los pegamos a la base con un '?'
    parametros_finales = "?" + "&".join(params_lista)
         
    return url_base + parametros_finales


# -----------
# FUNCION EXTRACCION DATOS
# -----------
async def extraer_ofertas_infojobs(url_busqueda, apikey, nombre_sector, limite=None):
    
    # configuracion de scroll
    instrucciones_scroll = [
        {"wait_for": "h2.ij-OfferCardContent-description-title"}, 
        {"scroll_y": 1000}, {"wait": 1500},
        {"scroll_y": 2000}, {"wait": 1500},
        {"scroll_y": 3000}, {"wait": 1500},
        {"scroll_y": 4000}, {"wait": 2000}
    ]

    #parametros de API
    params = {
        'apikey': apikey,
        'url': url_busqueda,
        'js_render': 'true',
        'premium_proxy': 'true',
        'js_instructions': json.dumps(instrucciones_scroll)
    }
    '''

    #config con antiboot
    instrucciones_scroll = [
    {"wait_for": "div.ij-OfferCardList"}, 
    {"scroll_y": 2000}, {"wait": 3000},    
    {"scroll_y": 4000}, {"wait": 3000},
    {"scroll_y": 6000}, {"wait": 3000}
    ]
    #parametros de API
    params = {
        'apikey': apikey,
        'url': url_busqueda,
        'js_render': 'true',
        'premium_proxy': 'true',
        'antibot': 'true', 
        'js_instructions': json.dumps(instrucciones_scroll)
    }
    '''
    
    # Conexión asíncrona segura con el context manager
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get('https://api.zenrows.com/v1/', params=params)
            response.raise_for_status()
        except Exception as e:
            print(f"Error de conexión: {str(e)}")
            return []
    
    # Codificacion para tildes y caracteres especiales
    response.encoding = 'utf-8'  

    # parseo HTMl
    soup = BeautifulSoup(response.text, 'html.parser')

    # obtencion de  las tarjetas de oferta
    tarjetas_oferta = soup.select('li.ij-List-item')
    
    #control de limite de resultados 
    if limite:
        tarjetas_oferta = tarjetas_oferta[:limite]
    
    # depuracion
    #print(f"Analizando {len(tarjetas_oferta)} ofertas de la pag.")

    resultados_db = []

    # obtencion datos de cada oferta
    for tarjeta in tarjetas_oferta:
        
        # filstro de publicidad
        def get_text(selector):
            element = tarjeta.select_one(selector)
            return element.text.strip() if element else None

        titulo_elemento = tarjeta.select_one('h2.ij-OfferCardContent-description-title')
        
        enlace_elemento = None
        if titulo_elemento:
            enlace_elemento = titulo_elemento.select_one('a')
        if not enlace_elemento:
            enlace_elemento = tarjeta.select_one('a')

        offer_url = enlace_elemento['href'] if enlace_elemento and 'href' in enlace_elemento.attrs else None
        
        # Filtros basicos
        if not offer_url: 
            continue 

        if "of-" not in offer_url and "ofertas-trabajo" not in offer_url: 
            continue
        if offer_url.startswith('//'): 
            offer_url = 'https:' + offer_url

        #Flitro para evitar footer y contacto con infojobs
        id_bruto = titulo_elemento.get('id') if titulo_elemento else None
        id_limpio = id_bruto.replace('job-title-', '') if id_bruto else None
        nombre_empresa = get_text('h3.ij-OfferCardContent-description-subtitle')

        #Evitar publicidad
        # Si no tiene ID comprobamos la empresa
        if not id_limpio:
            # Si tampoco tiene empresa, es publicidad. Lo saltamos.
            if not nombre_empresa:
                continue
            # Si tiene empresa pero no ID (Oferta Premium), le creamos un ID genérico para que la DB no se queje
            else:
                empresa_sin_espacios = nombre_empresa.replace(" ", "_").upper()
                id_limpio = f"PREMIUM_{empresa_sin_espacios}"


        # asegurarar titulo
        titulo_texto = titulo_elemento.text.strip() if titulo_elemento else (enlace_elemento.text.strip() if enlace_elemento else "Sin título")
        
        elementos_lista = tarjeta.select('li.ij-OfferCardContent-description-list-item')
        textos_lista = [el.text.strip() for el in elementos_lista if el]

        # Procesar salario
        salario_texto = get_text('span.ij-OfferCardContent-description-salary-info')
        salary_min_val = None
        salary_max_val = None
        
        if salario_texto:
            salario_limpio = salario_texto.replace('\xa0', '').replace('.', '')
            numeros = re.findall(r'\d+', salario_limpio)
            if len(numeros) >= 2:
                salary_min_val = int(numeros[0])
                salary_max_val = int(numeros[1])
            elif len(numeros) == 1:
                salary_min_val = int(numeros[0])

        contract_type_val = next((t for t in textos_lista if 'Contrato' in t or 'Autónomo' in t), None)
        contract_time_val = next((t for t in textos_lista if 'Jornada' in t or 'Horas' in t), None)

        #JSON convertido a Pydantic
        try:
            valid_lead = JobOfferRequest(
                portal_id = 2, 
                external_id=id_limpio,
                title=titulo_texto,
                company_name=nombre_empresa,
                location=get_text('span.ij-OfferCardContent-description-list-item-truncate'),
                offer_url=offer_url,

                job_description=get_text('p.ij-OfferCardContent-description-description'),
                published_at=get_text('span[data-testid="sincedate-tag"]'),
                sector=nombre_sector,
                
                salary_min=salary_min_val,
                salary_max=salary_max_val,
                contract_type=contract_type_val,
                contract_time=contract_time_val
            )

            resultados_db.append(valid_lead)

        except ValueError as e:
            print(f"Descartando oferta inválida: {e}")
            continue

    return resultados_db


#-----------
#EJECUCION 
#-----------
#debug
async def main():
    print("\n--- INICIO ---")

    todas_las_ofertas = []
    ids_watched = set()
    urls_watched = set()

    for num_pagina in range(1, paginas_a_escanear + 1):
        #debug
        #print(f"\n Escaneando pag {num_pagina} de {paginas_a_escanear}...")

        #construccion URL
        url_pagina = construir_url_infojobs(
            palabra_clave=busqueda_actual, 
            provincia=ciudad_actual, 
            pagina=num_pagina, 
            filtro_horas=horas_historico,
            id_sector=SECTORES.get(sector_buscar)
        )
        
        # Llamamos a la función asíncrona pasándole la API KEY desde el archivo settings
        resultados_pagina = await extraer_ofertas_infojobs(url_pagina, settings.ZENROWS_API_KEY, sector_buscar)

        if resultados_pagina:
            # Filtramos duplicados en memoria antes de añadir a la lista general
            for lead in resultados_pagina:
                if lead.external_id in ids_watched or lead.offer_url in urls_watched:
                    continue
                todas_las_ofertas.append(lead)
                ids_watched.add(lead.external_id)
                urls_watched.add(lead.offer_url)
                
            #debug
            #print(f" Se han añadido {len(resultados_pagina)} ofertas de la página {num_pagina}.")
        else:
            #debug
            #print(f" No se encontraron ofertas {num_pagina}.")
            break 

    #debug
    print(f"\n--- EXTRACCIÓN COMPLETADA ({len(todas_las_ofertas)} ofertas en total) ---")

    # Comentado hasta que la BBDD este disponible y usable, probar viabilidad del script
    
    # if todas_las_ofertas:
    #     insert_valid = [offer.model_dump() for offer in todas_las_ofertas]
    #     session = SessionLocal()

    #     try:
    #         inserts = insert(JobOfferRequest).values(insert_valid)

    #         inserts = inserts.on_conflict_do_nothing(
    #             index_element=['portal_id', 'external_id']
    #         )

    #         session.execute(inserts)
    #         session.commit()

    #     except Exception as e:
    #         session.rollback()
    #     finally:
    #         session.close()

if __name__ == "__main__":
    asyncio.run(main())