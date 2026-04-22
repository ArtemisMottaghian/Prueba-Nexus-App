-- =============================================
-- DEFINICION DE TIPOS PERSONALIZADOS
-- =============================================

-- Roles de acceso: admin, empresa cliente o gestor de RRHH
CREATE TYPE user_role AS ENUM ('admin', 'company', 'hr_manager');

-- Ciclo de vida de la oferta: desde que se detecta hasta que se gana o descarta
CREATE TYPE offer_status AS ENUM ('detected', 'contacted', 'negotiating', 'discarded', 'won');

-- Estado del pipeline para el cliente y para prospectos en companies
CREATE TYPE lead_status AS ENUM ('new', 'qualifying', 'negotiating', 'converted', 'lost');

-- Clasificacion de la entidad en companies: prospecto o cliente ya confirmado
CREATE TYPE entity_type AS ENUM ('scraping_prospect', 'confirmed_client');

-- Estado global del candidato
CREATE TYPE candidate_status AS ENUM ('active', 'passive', 'hired_elsewhere', 'blacklisted');

-- Estado del proceso de seleccion especifico para una oferta
CREATE TYPE application_status AS ENUM (
    'proposed',              -- Se le ha ofrecido al cliente
    'client_interested',     -- El cliente quiere verle
    'interviewing',          -- En proceso de entrevistas
    'offer_sent',            -- El cliente le ha hecho una oferta
    'hired',                 -- ¡Contratado!
    'rejected_by_client',    -- El cliente lo descarta
    'rejected_by_candidate', -- El candidato no le interesa
    'pool'                   -- Guardado para futuro
);


-- =============================================
-- TABLAS
-- =============================================

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE users IS 'Almacena las credenciales y roles de acceso al sistema';


CREATE TABLE job_portals (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL, -- Ej: Linkedin, Infojobs
    base_url   VARCHAR(255),
    is_active  BOOLEAN DEFAULT TRUE
);
COMMENT ON TABLE job_portals IS 'Listado de portales donde se realiza el scraping';


CREATE TABLE companies (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    cif               VARCHAR(50),
    sector            VARCHAR(255),
    website           VARCHAR(255),
    linkedin_url      VARCHAR(255),
    address           VARCHAR(500),
    lead_status       lead_status DEFAULT 'new',         -- Pipeline comercial del prospecto
    source_id         INT REFERENCES job_portals(id),    -- Portal de origen
    original_offer_id BIGINT,                            -- FK a job_offers (se añade tras crear esa tabla)
    entity_type       entity_type DEFAULT 'scraping_prospect',
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE companies IS 'Empresas detectadas como posibles clientes mediante scraping. No son clientes de Aratech.';


CREATE TABLE searches (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id),   -- Usuario que lanzó la búsqueda
    raw_query  TEXT NOT NULL,                 -- Texto original buscado
    ai_query   TEXT,                          -- Consulta optimizada por IA
    province   VARCHAR(100),
    status     VARCHAR(50),                   -- Estado del proceso de scraping
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE job_offers (
    id                  BIGSERIAL PRIMARY KEY,
    portal_id           INT REFERENCES job_portals(id),
    company_id          BIGINT REFERENCES companies(id), -- Empresa a la que pertenece la oferta
    managed_by_id       BIGINT REFERENCES users(id),     -- Gestor de RRHH asignado
    external_id         VARCHAR(255),                    -- ID original en el portal
    title               VARCHAR(255) NOT NULL,
    company_name        VARCHAR(255),                    -- Nombre textual (backup scraping)
    location            VARCHAR(255),
    offer_url           TEXT,
    job_description     TEXT,
    company_description TEXT,
    published_at        TIMESTAMPTZ,
    sector              VARCHAR(255),
    salary_min          INT,
    salary_max          INT,
    contract_type       VARCHAR(50),
    contract_time       VARCHAR(50),
    work_modality       VARCHAR(50),   -- Remoto, Híbrido, Presencial
    status              offer_status DEFAULT 'detected',
    priority            INT DEFAULT 3, -- Prioridad de 1 a 5
    is_favourite        BOOLEAN DEFAULT FALSE,
    scraped_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_salary_range      CHECK (salary_min <= salary_max),
    CONSTRAINT unique_offer_per_portal UNIQUE (portal_id, external_id)
);
COMMENT ON TABLE job_offers IS 'Ofertas laborales extraídas mediante scraping';

-- FK diferida de companies hacia job_offers
ALTER TABLE companies
    ADD CONSTRAINT fk_companies_original_offer
    FOREIGN KEY (original_offer_id) REFERENCES job_offers(id);


-- Tabla de unión para resultados de búsqueda (Many-to-Many)
CREATE TABLE search_results (
    id        BIGSERIAL PRIMARY KEY,
    search_id BIGINT REFERENCES searches(id) ON DELETE CASCADE,
    offer_id  BIGINT REFERENCES job_offers(id) ON DELETE CASCADE
);


CREATE TABLE clients (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT REFERENCES users(id) UNIQUE, -- Cuenta vinculada si la empresa tiene acceso
    company_id   BIGINT REFERENCES companies(id),    -- Empresa prospecto de la que proviene
    company_name VARCHAR(255) NOT NULL,
    sector       VARCHAR(255),
    cif          VARCHAR(255),
    direccion    VARCHAR(500),
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE clients IS 'Clientes reales de Aratech. Solo empresas que han firmado contrato.';


CREATE TABLE contacts (
    id               BIGSERIAL PRIMARY KEY,
    client_id        BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    company_id       BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    full_name        VARCHAR(255) NOT NULL,
    email            VARCHAR(255),
    phone            VARCHAR(50),
    job_title        VARCHAR(100), -- Cargo del contacto (CEO, RRHH, etc.)
    last_interaction TIMESTAMPTZ,

    -- Un contacto pertenece a un cliente real O a un prospecto, nunca a ambos
    CONSTRAINT chk_contact_single_owner CHECK (
        (client_id IS NOT NULL AND company_id IS NULL) OR
        (client_id IS NULL     AND company_id IS NOT NULL)
    )
);


CREATE TABLE tracking_history (
    id              BIGSERIAL PRIMARY KEY,
    client_id       BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    company_id      BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    offer_id        BIGINT REFERENCES job_offers(id),
    action_type     VARCHAR(255),  -- Ej: Llamada, Reunión, Email enviado
    previous_status lead_status,
    new_status      lead_status,
    comments        TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE tracking_history IS 'Log detallado de acciones comerciales y cambios de estado';


CREATE TABLE candidates (
    id           BIGSERIAL PRIMARY KEY,
    first_name   VARCHAR(100) NOT NULL,
    last_name    VARCHAR(100) NOT NULL,
    email        VARCHAR(255) UNIQUE NOT NULL,
    phone        VARCHAR(50),
    location     VARCHAR(255),
    source       VARCHAR(100),
    experience   VARCHAR(100),
    linkedin_url VARCHAR(255),
    cv_url       TEXT,   -- Link al archivo (S3, Cloudinary...)
    skills       TEXT,
    status       candidate_status DEFAULT 'active',
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- Registro de cada cambio de estado de los candidatos
CREATE TABLE candidate_status_history (
    id              BIGSERIAL PRIMARY KEY,
    candidate_id    BIGINT REFERENCES candidates(id) ON DELETE CASCADE,
    previous_status candidate_status,
    new_status      candidate_status,
    changed_by      BIGINT REFERENCES users(id),
    comments        TEXT,
    changed_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- Relación candidato ↔ oferta
CREATE TABLE job_applications (
    id           BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT REFERENCES candidates(id) ON DELETE CASCADE,
    offer_id     BIGINT REFERENCES job_offers(id) ON DELETE CASCADE,
    status       application_status DEFAULT 'proposed',
    feedback     TEXT,
    hired_at     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_candidate_application UNIQUE (candidate_id, offer_id)
);


CREATE TABLE interviews (
    id               BIGSERIAL PRIMARY KEY,
    application_id   BIGINT REFERENCES job_applications(id) ON DELETE CASCADE,
    interviewer_id   BIGINT REFERENCES users(id),
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,
    meeting_link     TEXT,
    result           VARCHAR(50), -- 'passed', 'failed', 'no-show', 'pending'
    feedback         TEXT,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE error_logs (
    id          BIGSERIAL PRIMARY KEY,
    error_code  VARCHAR(100) NOT NULL,
    message     TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE error_logs IS 'Registro de errores del sistema';


-- Comentarios sobre clientes reales
CREATE TABLE client_comments (
    id         BIGSERIAL PRIMARY KEY,
    client_id  BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    user_id    BIGINT REFERENCES users(id),
    comment    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE client_comments IS 'Comentarios y notas sobre clientes reales';


-- Comentarios sobre candidatos
CREATE TABLE candidate_comments (
    id           BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT REFERENCES candidates(id) ON DELETE CASCADE,
    user_id      BIGINT REFERENCES users(id),
    comment      TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE candidate_comments IS 'Comentarios y notas sobre candidatos';

-- Comentarios sobre empresas
CREATE TABLE IF NOT EXISTS company_comments (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- Actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Registra cambios de estado de candidatos en candidate_status_history
CREATE OR REPLACE FUNCTION log_candidate_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO candidate_status_history (candidate_id, previous_status, new_status, changed_at)
        VALUES (OLD.id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Registra cambios de lead_status de clients en tracking_history
CREATE OR REPLACE FUNCTION log_client_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_status IS DISTINCT FROM OLD.lead_status THEN
        INSERT INTO tracking_history (client_id, company_id, offer_id, action_type, previous_status, new_status, comments, recorded_at)
        VALUES (OLD.id, NULL, NULL, 'Cambio de estado automático', OLD.lead_status, NEW.lead_status, NULL, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Registra cambios de lead_status de companies en tracking_history
CREATE OR REPLACE FUNCTION log_company_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_status IS DISTINCT FROM OLD.lead_status THEN
        INSERT INTO tracking_history (company_id, client_id, offer_id, action_type, previous_status, new_status, comments, recorded_at)
        VALUES (OLD.id, NULL, NULL, 'Cambio de estado automático', OLD.lead_status, NEW.lead_status, NULL, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Triggers de updated_at
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_offers_modtime
    BEFORE UPDATE ON job_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_modtime
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_modtime
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_modtime
    BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_modtime
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_comments_modtime
    BEFORE UPDATE ON client_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidate_comments_modtime
    BEFORE UPDATE ON candidate_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers de auditoría
CREATE TRIGGER trg_log_candidate_status_change
    AFTER UPDATE OF status ON candidates
    FOR EACH ROW EXECUTE FUNCTION log_candidate_status_change();

CREATE TRIGGER trg_log_client_lead_status_change
    AFTER UPDATE OF lead_status ON clients
    FOR EACH ROW EXECUTE FUNCTION log_client_lead_status_change();

CREATE TRIGGER trg_log_company_lead_status_change
    AFTER UPDATE OF lead_status ON companies
    FOR EACH ROW EXECUTE FUNCTION log_company_lead_status_change();


-- =============================================
-- ÍNDICES
-- =============================================

-- Claves foráneas (acelerar JOINs)
CREATE INDEX idx_searches_user_id             ON searches(user_id);
CREATE INDEX idx_job_offers_portal_id         ON job_offers(portal_id);
CREATE INDEX idx_job_offers_company_id        ON job_offers(company_id);
CREATE INDEX idx_job_offers_managed_by        ON job_offers(managed_by_id);
CREATE INDEX idx_search_results_search_id     ON search_results(search_id);
CREATE INDEX idx_search_results_offer_id      ON search_results(offer_id);
CREATE INDEX idx_clients_company_id           ON clients(company_id);
CREATE INDEX idx_contacts_client_id           ON contacts(client_id);
CREATE INDEX idx_contacts_company_id          ON contacts(company_id);
CREATE INDEX idx_tracking_history_client_id   ON tracking_history(client_id);
CREATE INDEX idx_tracking_history_company_id  ON tracking_history(company_id);
CREATE INDEX idx_tracking_history_offer_id    ON tracking_history(offer_id);
CREATE INDEX idx_job_applications_candidate   ON job_applications(candidate_id);
CREATE INDEX idx_job_applications_offer       ON job_applications(offer_id);
CREATE INDEX idx_client_comments_client_id    ON client_comments(client_id);
CREATE INDEX idx_client_comments_user_id      ON client_comments(user_id);
CREATE INDEX idx_candidate_comments_cand_id   ON candidate_comments(candidate_id);
CREATE INDEX idx_candidate_comments_user_id   ON candidate_comments(user_id);

-- Filtros frecuentes
CREATE INDEX idx_users_email               ON users(email);
CREATE INDEX idx_job_offers_status         ON job_offers(status);
CREATE INDEX idx_searches_status           ON searches(status);
CREATE INDEX idx_clients_lead_status       ON clients(lead_status);
CREATE INDEX idx_candidates_status         ON candidates(status);
CREATE INDEX idx_job_applications_status   ON job_applications(status);
CREATE INDEX idx_companies_lead_status     ON companies(lead_status);
CREATE INDEX idx_companies_source_id       ON companies(source_id);

-- Ordenamiento (acelerar ORDER BY)
CREATE INDEX idx_job_offers_scraped_at        ON job_offers(scraped_at DESC);
CREATE INDEX idx_tracking_history_recorded_at ON tracking_history(recorded_at DESC);

-- Texto simple (acelerar LIKE %texto%)
CREATE INDEX idx_job_offers_title    ON job_offers(title);
CREATE INDEX idx_job_offers_company  ON job_offers(company_name);
CREATE INDEX idx_clients_company     ON clients(company_name);
CREATE INDEX idx_companies_name      ON companies(name);
CREATE INDEX idx_companies_cif       ON companies(cif);
CREATE INDEX idx_candidates_skills   ON candidates(skills);
CREATE INDEX idx_candidates_email    ON candidates(email);

-- Logs de errores
CREATE INDEX idx_error_logs_occurred_at ON error_logs(occurred_at DESC);
CREATE INDEX idx_error_logs_is_resolved ON error_logs(is_resolved);
CREATE INDEX idx_error_logs_error_code  ON error_logs(error_code);


-- =============================================
-- VISTAS
-- =============================================

-- Resumen de candidaturas
CREATE OR REPLACE VIEW v_application_metrics AS
SELECT
    ja.id AS application_id,
    ja.status,
    c.first_name,
    c.last_name,
    jo.title AS job_title,
    (SELECT COUNT(*) FROM interviews i WHERE i.application_id = ja.id) AS interview_count,
    DATE_PART('day', NOW() - ja.created_at) AS days_in_process
FROM job_applications ja
JOIN candidates c  ON ja.candidate_id = c.id
JOIN job_offers jo ON ja.offer_id = jo.id;


-- Errores pendientes de resolver
CREATE OR REPLACE VIEW v_pending_errors AS
SELECT
    id,
    error_code,
    message,
    occurred_at
FROM error_logs
WHERE is_resolved = FALSE
ORDER BY occurred_at DESC;


-- Resumen de ofertas por empresa
CREATE OR REPLACE VIEW v_companies_summary AS
SELECT
    c.id,
    c.name,
    c.cif,
    c.sector,
    c.lead_status,
    COUNT(jo.id)                                                        AS total_offers,
    COUNT(jo.id) FILTER (WHERE jo.status = 'won')                       AS won_offers,
    COUNT(jo.id) FILTER (WHERE jo.status NOT IN ('discarded', 'won'))   AS active_offers
FROM companies c
LEFT JOIN job_offers jo ON jo.company_id = c.id
GROUP BY c.id;