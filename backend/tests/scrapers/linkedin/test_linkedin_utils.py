import pytest

from backend.app.services.scrapers.linkedin.utils import parse_salary, is_valid_sector

@pytest.mark.parametrize(
    "input_text, expected_output",
    [
        ("45.5k", 45500),
        ("45,5k", 45500),
        ("Salario: 45.5k euros", 45500),
        ("45k", 45000),
        ("30K", 30000),
        ("45.000", 45000),
        ("45,000", 45000),
        ("45000", 45000),
        ("Salario no especificado", None),
        ("A convenir", None),
        (None, None),
    ],
)
def test_parse_salary(input_text, expected_output):
    """Prueba que el parseo de salarios de LinkedIn soporte todos los formatos posibles"""
    resultado = parse_salary(input_text)
    assert resultado == expected_output


def test_is_valid_sector():
    """Prueba que la validación de sectores funciona correctamente"""
    sector_mapping = {
        "101": ["Tecnología", "Informática", "Software"],
        "102": ["Recursos Humanos", "HR"],
    }

    assert is_valid_sector("Desarrollo de Software", ["101"], sector_mapping) is True

    assert is_valid_sector("Construcción", ["101", "102"], sector_mapping) is False

    assert is_valid_sector("Cualquier cosa", [], sector_mapping) is True
