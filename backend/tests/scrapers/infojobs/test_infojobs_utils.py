import pytest

from app.services.scrapers.infojobs.infojobs_utils import extract_salary


@pytest.mark.parametrize(
    "input_text, expected_output",
    [
        # 1. Caso ideal: un solo salario
        ("24.000€", [24000]),
        # 2. Caso ideal: rango salarial
        ("24.000 - 30.000 euros", [24000, 30000]),
        # 3. Texto sucio con palabras alrededor
        ("Salario entre 18.000€ y 22.000€ brutos al año", [18000, 22000]),
        # 4. Caso trampa: salarios muy bajos (tu código exige >= 4 dígitos)
        ("300 euros al mes", None),
        # 5. Textos sin números
        ("Salario a convenir", None),
        # 6. Ausencia de datos
        (None, None),
    ],
)
def test_extract_salary_infojobs(input_text, expected_output):
    """
    Prueba que la función extract_salary limpia y extrae correctamente
    los rangos salariales en múltiples escenarios.
    """
    resultado = extract_salary(input_text)
    assert resultado == expected_output
