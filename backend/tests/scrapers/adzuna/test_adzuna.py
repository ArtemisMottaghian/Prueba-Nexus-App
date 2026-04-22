import pytest

from backend.app.services.scrapers.scraper_vacancies_adzuna import determine_work_modality


@pytest.mark.parametrize(
    "title, description, location, expected_output",
    [
        # Casos de Remoto
        ("Python Developer", "Trabajo 100% remote desde casa", "Madrid", "Remoto"),
        ("Desarrollador Backend", "Teletrabajo admitido", "Barcelona", "Remoto"),
        ("Software Engineer REMOTO", "Cualquier lugar", "España", "Remoto"),

        # Casos de Híbrido
        (
            "Frontend Developer",
            "Modalidad híbrida (2 días oficina)",
            "Valencia",
            "Híbrido",
        ),
        ("Data Scientist (Hybrid)", "Great team", "London", "Híbrido"),
        ("DevOps Hibrid", "Ubicación céntrica", "Sevilla", "Híbrido"),
        
        # Casos de Presencial
        ("IT Support", "Trabajo 100% presencial", "Bilbao", "Presencial"),
        ("System Admin", "We work on-site everyday", "Madrid", "Presencial"),
        ("Recepcionista", "Se requiere trabajo en oficina", "Málaga", "Presencial"),

        # Casos sin modalidad clara
        (
            "Desarrollador Java",
            "Buscamos talento para nuestro equipo",
            "Zaragoza",
            None,
        ),
        ("", "", "", None),
        
        # Casos de case insensitive
        ("PROGRAMADOR", "IMPRESCINDIBLE TELETRABAJO", "ESPAÑA", "Remoto"),
        ("designer", "working HYBRID model", "paris", "Híbrido"),
    ],
)
def test_determine_work_modality(title, description, location, expected_output):
    """
    Prueba que la función _determine_work_modality detecta correctamente
    el modelo de trabajo buscando palabras clave en título, descripción y ubicación.
    """
    resultado = determine_work_modality(title, description, location)
    assert resultado == expected_output
