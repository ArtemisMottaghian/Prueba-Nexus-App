-- Definicion de tipos personalizados

-- Roles de acceso: admin, empresa cliente o gestor de RRHH
CREATE TYPE user_role AS ENUM ('admin', 'company', 'hr_manager');

-- Ciclo de vida de la oferta: desde que se detecta hasta que se gana o descarta
CREATE TYPE offer_status AS ENUM ('detected', 'contacted', 'negotiating', 'discarded', 'won');

-- Estado del pipeline para el cliente
CREATE TYPE lead_status AS ENUM ('new', 'qualifying', 'negotiating', 'converted', 'lost');

-- Clasificacion de la entidad: prospecto de scraping o cliente ya confirmado
CREATE TYPE entity_type AS ENUM ('scraping_prospect', 'confirmed_client');
