import re

# Sinónimos y abreviaciones comunes en IT (España)
SKILL_ALIASES: dict[str, str] = {
    # Lenguajes
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "golang": "go",
    "c sharp": "c#",
    "cplusplus": "c++",
    # Frontend
    "react.js": "react",
    "reactjs": "react",
    "vue.js": "vue",
    "vuejs": "vue",
    "next.js": "nextjs",
    "nuxt.js": "nuxtjs",
    "svelte.js": "svelte",
    "tailwindcss": "tailwind",
    # Backend
    "node": "nodejs",
    "node.js": "nodejs",
    "django rest framework": "django",
    "drf": "django",
    "spring boot": "spring",
    "asp.net": "dotnet",
    ".net": "dotnet",
    # Bases de datos
    "postgres": "postgresql",
    "psql": "postgresql",
    "pg": "postgresql",
    "mongo": "mongodb",
    "redis cache": "redis",
    "sql server": "sqlserver",
    "ms sql": "sqlserver",
    # Cloud / DevOps
    "k8s": "kubernetes",
    "gcp": "google cloud",
    "google cloud platform": "google cloud",
    "amazon web services": "aws",
    "azure devops": "azure",
    "ci/cd": "cicd",
    "ci cd": "cicd",
    "github actions": "cicd",
    "gitlab ci": "cicd",
    "jenkins": "cicd",
    # IA / Data
    "ml": "machine learning",
    "deep learning": "machine learning",
    "ia": "machine learning",
    "inteligencia artificial": "machine learning",
    "nlp": "procesamiento lenguaje natural",
    "data science": "ciencia de datos",
    "bi": "business intelligence",
    "power bi": "business intelligence",
    "tableau": "business intelligence",
    # Metodologías
    "scrum master": "scrum",
    "agile scrum": "scrum",
    "product owner": "scrum",
}

_SPLIT_RE = re.compile(r"[|,;\n/·•]+")


def normalize_skill(raw: str) -> str:
    s = raw.strip().lower()
    s = re.sub(r"[^\w\s+#.]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return SKILL_ALIASES.get(s, s)


def parse_skills(text: str | None) -> set[str]:
    """Parse a pipe/comma/semicolon separated skills string."""
    if not text:
        return set()
    parts = _SPLIT_RE.split(text)
    return {normalize_skill(p) for p in parts if len(p.strip()) > 1}


# Vocabulario de skills conocidas para extraer de texto libre
_KNOWN_SKILLS: set[str] = {
    # Lenguajes
    "python", "javascript", "typescript", "java", "go", "rust", "c++", "c#",
    "php", "ruby", "kotlin", "swift", "scala", "r", "dart", "bash", "shell",
    # Frontend
    "react", "angular", "vue", "nextjs", "nuxtjs", "svelte", "html", "css",
    "tailwind", "sass", "webpack", "vite",
    # Backend
    "nodejs", "django", "fastapi", "flask", "spring", "dotnet", "laravel",
    "express", "nestjs", "fastify",
    # Bases de datos
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "sqlserver", "sqlite", "dynamodb",
    # Cloud / DevOps
    "aws", "azure", "google cloud", "docker", "kubernetes", "terraform",
    "ansible", "cicd", "linux", "nginx",
    # Data / IA
    "machine learning", "tensorflow", "pytorch", "pandas", "numpy",
    "scikit-learn", "spark", "hadoop", "airflow", "dbt",
    "business intelligence",
    # Herramientas
    "git", "jira", "figma", "postman", "graphql", "api rest", "microservices",
    "scrum", "agile",
}


def parse_skills_from_description(text: str | None) -> set[str]:
    """
    Extrae skills de texto libre (descripción de oferta o experiencia).
    Combina vocabulario fijo + parsing explícito.
    """
    if not text:
        return set()
    lower = text.lower()
    found: set[str] = set()

    # 1. Buscar skills conocidas en el texto
    for skill in _KNOWN_SKILLS:
        if skill in lower:
            found.add(skill)

    # 2. Parsear skills explícitamente listadas con separadores
    found.update(parse_skills(text))

    return found
