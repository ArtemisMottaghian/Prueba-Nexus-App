import schedule
import time
import random
from workers.scraper_infojobs_ZenRows import main as extraer_ofertas_infojobs
from datetime import datetime

# variables globales
hora_base = "02:00"
segundos_maximos=10800  # 3 horas en segundos
#segundos_maximos=180  # 3 min en segundos para pruebas rapidas

#-----
#mostrar hora a la que se ejecuta
#-------
def mostrar_hora():
    hora_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{hora_actual}] Hora actual")

#-----
# Calculo de tiempo de espera aleatorio
#-------
def sleep_random_time(min_seconds=0, max_seconds=segundos_maximos):
    segundos_espera = random.randint(min_seconds, max_seconds)
    time.sleep(segundos_espera)

#--------------------
# Tarea programada a una hora fija todos los dias
#------------
'''
def tarea_automatica():

    print("Iniciando tarea programada...")
    mostrar_hora()
    extraer_ofertas_infojobs()

schedule.every().day.at(hora_base).do(tarea_automatica)
'''

#--------------------
# Tarea programada todos los dias a hora random
#------------
'''
def tarea_automatica():

    print("Iniciando tarea programada...")
    sleep_random_time()
    mostrar_hora()
    extraer_ofertas_infojobs()

schedule.every().day.at(hora_base).do(tarea_automatica)
'''

#--------------------
# Tarea programada a Horas aleatorias de lunes a viernes
#------------

def tarea_aleatoria_madrugada():
    # se ejecutara entre las 02:00 y las 05:00

    # calculo de hora aleatorio
    sleep_random_time()

    # inicio
    print("Iniciando el scraping")
    mostrar_hora()
    extraer_ofertas_infojobs()

# Programamos la tarea de lunes a viernes a la misma hora base
schedule.every().monday.at(hora_base).do(tarea_aleatoria_madrugada)
schedule.every().tuesday.at(hora_base).do(tarea_aleatoria_madrugada)
schedule.every().wednesday.at(hora_base).do(tarea_aleatoria_madrugada)
schedule.every().thursday.at(hora_base).do(tarea_aleatoria_madrugada)
schedule.every().friday.at(hora_base).do(tarea_aleatoria_madrugada)


# ----
# Ejecucion
#----
if __name__ == "__main__":
    print(f"Iniciando el planificador")

    while True:
        schedule.run_pending()
        time.sleep(60)