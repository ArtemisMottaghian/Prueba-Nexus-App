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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
    scraped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPm

    CONSTRAINT check_salary_range CHECK (salary_min <= salary_max),
    CONSTRAINT unique_offer_per_portal UNIQUE (portal_id, external_id)
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
    user_id BIGINT REFERENCES users(id) UNIQUE, -- Cuenta vinculada si la empresa tiene acceso
    source_id INT REFERENCES job_portals(id), -- Portal de origen
    original_offer_id BIGINT REFERENCES job_offers(id), -- Oferta que originó el contacto
    company_name VARCHAR(255) NOT NULL,
    entity_type entity_type,
    lead_status lead_status,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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

-- FUNCIONES Y TRIGGERS

-- Funcion para actualizar la fecha de modificacion automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGERS AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP
    RETURN NEW;
END;
$$ language 'plpgsql'

-- Triggers aplicados a las tablas claves
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_offers_modtime
    BEFORE UPDATE ON job_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_modtime
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Indices
-- Indices de claves foraneas (para acelerar joins)
CREATE INDEX idx_searches_user_id ON searches(user_id);
CREATE INDEX idx_job_offers_portal_id ON job_offers(portal_id);
CREATE INDEX idx_job_offers_managed_by ON job_offers(managed_by_id);
CREATE INDEX idx_search_results_search_id ON search_results(search_id);
CREATE INDEX idx_search_results_offer_id ON search_results(offer_id);
CREATE INDEX idx_clients_source_id ON clients(source_id);
CREATE INDEX idx_contacts_client_id ON contacts(client_id);
CREATE INDeX idx_tracking_history_client_id ON tracking_history(client_id);
CREATE INDEX idx_tracking_history_offer_id ON tracking_history(offer_id);

-- Indices de Filtros frecuentes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_job_offers_status ON job_offers(status);
CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_clients_lead_status ON clients(lead_status);

-- Indices de Ordenamiento (para acelerar ORDER BY)
CREATE INDEX idx_job_offers_scraped_at ON job_offers(scraped_at DESC);
CREATE INDEX idx_tracking_history_recorded_at ON tracking_history(recorded_at DESC);

-- Indices de texto simple (para acelerar LIKE %texto%)
CREATE INDEX idx_job_offers_title ON job_offers(title);
CREATE INDEX idx_job_offers_company ON job_offers(company_name)
CREATE INDEX idx_clients_company ON clients(company_name);