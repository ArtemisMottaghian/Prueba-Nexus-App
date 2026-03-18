-- Definicion de tipos personalizados

-- Roles de acceso: admin, empresa cliente o gestor de RRHH
CREATE TYPE user_role AS ENUM ('admin', 'company', 'hr_manager');

-- Ciclo de vida de la oferta: desde que se detecta hasta que se gana o descarta
CREATE TYPE offer_status AS ENUM ('detected', 'contacted', 'negotiating', 'discarded', 'won');

-- Estado del pipeline para el cliente
CREATE TYPE lead_status AS ENUM ('new', 'qualifying', 'negotiating', 'converted', 'lost');

-- Clasificacion de la entidad: prospecto de scraping o cliente ya confirmado
CREATE TYPE entity_type AS ENUM ('scraping_prospect', 'confirmed_client');


CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPT
);
COMMENT ON TABLE users IS 'Almacena las credenciales y roles de acceso al sistema';

CREATE TABLE job_portals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- EJ: Linkedin, Infojobs
    base_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);
COMMENT ON TABLE job_portals IS 'Listado de portales donde se realiza el scraping';

CREATE TABLE searches (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id), -- Usuario que lanzó la búsqueda
    raw_query TEXT NOT NULL, -- Texto original buscado
    ai_query TEXT, -- Consulta optimizada por IA
    province VARCHAR(100),
    status VARCHAR(50), -- Estado del proceso de scraping
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_offers (
    id BIGSERIAL PRIMARY KEY,
    portal_id INT REFERENCES job_portals(id),
    managed_by_id BIGINT REFERENCES users(id), -- Gestor de RRHH asignado para el seguimiento
    external_id VARCHAR(255), -- ID original en el portal (InfoJobs ID, etc.)
    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    location VARCHAR(255),
    offer_url TEXT,
    job_description TEXT,
    company_description TEXT,
    published_at TIMESTAMPTZ,
    sector VARCHAR(255),
    salary_min INT,
    salary_max INT,
    contract_type VARCHAR(50),
    contract_time VARCHAR(50),
    work_modality VARCHAR(50), -- Remoto, Híbrido, Presencial
    status offer_status DEFAULT 'detected',
    priority INT DEFAULT 3, -- Prioridad de 1 a 5
    scraped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE job_offers IS 'Ofertas laborales extraídas mediante scraping';

-- Tabla de unión para resultados de búsqueda (Many-to-Many)
CREATE TABLE search_results (
    id BIGSERIAL PRIMARY KEY,
    search_id BIGINT REFERENCES searches(id) ON DELETE CASCADE,
    offer_id BIGINT REFERENCES job_offers(id) ON DELETE CASCADE
);

CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id), -- Cuenta vinculada si la empresa tiene acceso
    source_id INT REFERENCES job_portals(id), -- Portal de origen
    original_offer_id BIGINT REFERENCES job_offers(id), -- Oferta que originó el contacto
    company_name VARCHAR(255) NOT NULL,
    entity_type entity_type,
    lead_status lead_status,
    is_active_client BOOLEAN DEFAULT FALSE
);
COMMENT ON TABLE clients IS 'Empresas gestionadas en el flujo comercial';

CREATE TABLE contacts (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    job_title VARCHAR(100), -- Cargo del contacto (CEO, RRHH, etc.)
    last_interaction TIMESTAMPTZ
);

CREATE TABLE tracking_history (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    offer_id BIGINT REFERENCES job_offers(id), -- Relación con oferta si aplica
    action_type VARCHAR(255), -- Ej: Llamada, Reunión, Email enviado
    previous_status lead_status,
    new_status lead_status,
    comments TEXT,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE tracking_history IS 'Log detallado de acciones comerciales y cambios de estado';