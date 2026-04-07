# Guía de Commits para Módulo Clientes y Vacantes

Tal y como solicitaste, aquí tienes paso a paso los comandos de terminal que debes ejecutar para versionar los cinco archivos modificados. 

> **Nota sobre el `git push` y `git pull`:**  
> Como mencionabas en el audio que no estabas seguro si sale mejor hacer el push al principio o al final, te respondo: **lo óptimo es hacer un único `git pull origin develop` al principio, luego todos los `git add` y `git commit`, y finalizar con un solo `git push` al final**. 
> 
> Realizarlo en cada archivo individual es redundante y puede llegar a generar comprobaciones innecesarias en el repositorio remoto. Por ello, te presento primero la **forma recomendada (óptima)** y luego la **forma archivo por archivo** (exactamente como lo pediste).

---

## Opción 1: Forma Recomendada (Todo junto)

Abre la terminal de tu proyecto en la ruta raíz y ejecuta estos comandos en este orden:

```bash
# 1. Traer los últimos cambios de develop a tu rama actual
git pull origin develop

# 2. Archivo: index.css
git add src/index.css
git commit -m "style: update global responsive styles and layout rules"

# 3. Archivo: Clientes.jsx
git add src/pages/Clientes.jsx
git commit -m "feat: implement mobile list and detail toggle support"

# 4. Archivo: ClienteDetail.css
git add src/components/crm/ClienteDetail.css
git commit -m "style: refine client detail tab layout and responsive design"

# 5. Archivo: VacancyModal.jsx
git add src/components/recruitment/VacancyModal.jsx
git commit -m "feat: add activity tracking and documents tabs to vacancy modal"

# 6. Archivo: VacancyModal.css
git add src/components/recruitment/VacancyModal.css
git commit -m "style: improve vacancy modal structural layout and tabs"

# 7. Subir todos los commits al repositorio remoto (a tu rama)
git push origin feature/modulo-clientes
```

---

## Opción 2: Archivo por Archivo (Paso a paso aislado)

Si prefieres hacerlo de manera estrictamente individual como comentaste en el audio (para cada archivo su propio ciclo entero), puedes usar estos bloques uno por uno:

### 1. index.css
```bash
git pull origin develop
git add src/index.css
git commit -m "style: update global responsive styles and layout rules"
git push origin feature/modulo-clientes
```

### 2. Clientes.jsx
```bash
git pull origin develop
git add src/pages/Clientes.jsx
git commit -m "feat: implement mobile list and detail toggle support"
git push origin feature/modulo-clientes
```

### 3. ClienteDetail.css
```bash
git pull origin develop
git add src/components/crm/ClienteDetail.css
git commit -m "style: refine client detail tab layout and responsive design"
git push origin feature/modulo-clientes
```

### 4. VacancyModal.jsx
```bash
git pull origin develop
git add src/components/recruitment/VacancyModal.jsx
git commit -m "feat: add activity tracking and documents tabs to vacancy modal"
git push origin feature/modulo-clientes
```

### 5. VacancyModal.css
```bash
git pull origin develop
git add src/components/recruitment/VacancyModal.css
git commit -m "style: improve vacancy modal structural layout and tabs"
git push origin feature/modulo-clientes
```
