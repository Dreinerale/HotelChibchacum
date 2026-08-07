-- ============================================================
-- Hotel Chibchacum PMS  v1.2 FINAL
-- Ejecutar en: https://supabase.com/dashboard/project/jwdranlrwjkfixzqdrtr/sql/new
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre         text        NOT NULL,
  rol            text        NOT NULL DEFAULT 'recepcion'
                               CHECK (rol IN ('administrador','recepcion')),
  activo         bool        NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  creado_por     uuid        REFERENCES auth.users(id),
  modificado_en  timestamptz,
  modificado_por uuid        REFERENCES auth.users(id)
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. mi_rol()
CREATE OR REPLACE FUNCTION mi_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM profiles WHERE id = auth.uid() AND activo = true
$$;

-- 3. handle_new_user trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, nombre, rol, activo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email,'@',1)),
    'recepcion', true
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. rooms
CREATE TABLE IF NOT EXISTS rooms (
  id                   bigserial     PRIMARY KEY,
  numero               text          UNIQUE NOT NULL,
  tipo                 text          NOT NULL CHECK (tipo IN ('Sencilla','Doble','Triple','Grande')),
  capacidad            int           NOT NULL DEFAULT 1 CHECK (capacidad >= 1),
  precio_persona_noche numeric(12,2) NOT NULL CHECK (precio_persona_noche >= 0),
  estado               text          NOT NULL DEFAULT 'Disponible'
                                       CHECK (estado IN ('Disponible','Ocupada','Limpieza','Mantenimiento')),
  observaciones        text          NOT NULL DEFAULT '',
  es_demo              bool          NOT NULL DEFAULT false
);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 5. room_state_logs
CREATE TABLE IF NOT EXISTS room_state_logs (
  id            bigserial   PRIMARY KEY,
  room_id       bigint      NOT NULL REFERENCES rooms(id),
  estado_antes  text        NOT NULL,
  estado_nuevo  text        NOT NULL,
  usuario_id    uuid        NOT NULL REFERENCES profiles(id),
  registrado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE room_state_logs ENABLE ROW LEVEL SECURITY;

-- 6. guests
CREATE TABLE IF NOT EXISTS guests (
  id                      bigserial PRIMARY KEY,
  primer_nombre           text      NOT NULL,
  segundo_nombre          text      NOT NULL DEFAULT '',
  primer_apellido         text      NOT NULL,
  segundo_apellido        text      NOT NULL DEFAULT '',
  tipo_identificacion     text      NOT NULL
    CHECK (tipo_identificacion IN (
      'Cédula de ciudadanía','Cédula de extranjería','Pasaporte',
      'Tarjeta de identidad','Registro civil','PEP/PPT','Otro')),
  numero_identificacion   text      NOT NULL,
  UNIQUE (tipo_identificacion, numero_identificacion),
  nacionalidad            text      NOT NULL DEFAULT 'Colombiana',
  fecha_nacimiento        date,
  pais_residencia         text      NOT NULL DEFAULT 'Colombia',
  departamento_residencia text      NOT NULL DEFAULT '',
  ciudad_residencia       text      NOT NULL DEFAULT '',
  telefono                text      NOT NULL DEFAULT '',
  email                   text      NOT NULL DEFAULT '',
  direccion               text      NOT NULL DEFAULT '',
  profesion               text      NOT NULL DEFAULT '',
  placa_vehiculo          text      NOT NULL DEFAULT '',
  es_demo                 bool      NOT NULL DEFAULT false
);
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- 7. stays
CREATE TABLE IF NOT EXISTS stays (
  id                    bigserial     PRIMARY KEY,
  huesped_id            bigint        NOT NULL REFERENCES guests(id),
  habitacion_id         bigint        NOT NULL REFERENCES rooms(id),
  usuario_id            uuid          REFERENCES profiles(id),
  fecha_ingreso         timestamptz   NOT NULL,
  fecha_salida_estimada timestamptz   NOT NULL,
  fecha_salida_real     timestamptz,
  adultos               int           NOT NULL DEFAULT 1 CHECK (adultos >= 1),
  ninos                 int           NOT NULL DEFAULT 0 CHECK (ninos >= 0),
  total_ocupantes       int           NOT NULL DEFAULT 1 CHECK (total_ocupantes >= 1),
  valor_persona_noche   numeric(12,2) NOT NULL CHECK (valor_persona_noche >= 0),
  metodo_pago           text          NOT NULL
    CHECK (metodo_pago IN ('Efectivo','Tarjeta','Transferencia','Nequi','Daviplata')),
  observaciones         text          NOT NULL DEFAULT '',
  observaciones_salida  text          NOT NULL DEFAULT '',
  noches                int,
  total                 numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN noches IS NOT NULL THEN valor_persona_noche * total_ocupantes * noches ELSE NULL END
  ) STORED,
  estado                text          NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa','finalizada','anulada')),
  anulado_en            timestamptz,
  anulado_por           uuid          REFERENCES profiles(id),
  motivo_anulacion      text          NOT NULL DEFAULT '',
  es_demo               bool          NOT NULL DEFAULT false,
  CONSTRAINT salida_posterior_ingreso CHECK (fecha_salida_estimada > fecha_ingreso),
  CONSTRAINT salida_real_posterior_ingreso CHECK (fecha_salida_real IS NULL OR fecha_salida_real > fecha_ingreso),
  CONSTRAINT anulacion_requiere_campos CHECK (
    estado <> 'anulada' OR
    (motivo_anulacion <> '' AND anulado_en IS NOT NULL AND anulado_por IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_habitacion_activa ON stays (habitacion_id) WHERE estado = 'activa';
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION validar_capacidad_stay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cap int;
BEGIN
  SELECT capacidad INTO v_cap FROM rooms WHERE id = NEW.habitacion_id;
  IF NEW.total_ocupantes > v_cap THEN
    RAISE EXCEPTION 'Capacidad excedida: habitación admite % persona(s), se registran %.', v_cap, NEW.total_ocupantes;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_validar_capacidad ON stays;
CREATE TRIGGER trig_validar_capacidad BEFORE INSERT ON stays
  FOR EACH ROW EXECUTE FUNCTION validar_capacidad_stay();

CREATE OR REPLACE FUNCTION validar_reduccion_capacidad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ocupantes int;
BEGIN
  IF NEW.capacidad >= OLD.capacidad THEN RETURN NEW; END IF;
  SELECT total_ocupantes INTO v_ocupantes FROM stays
  WHERE habitacion_id = NEW.id AND estado = 'activa' LIMIT 1;
  IF FOUND AND NEW.capacidad < v_ocupantes THEN
    RAISE EXCEPTION 'No se puede reducir la capacidad: estadía activa con % ocupante(s). Nueva capacidad: %.', v_ocupantes, NEW.capacidad;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_validar_reduccion_capacidad ON rooms;
CREATE TRIGGER trig_validar_reduccion_capacidad BEFORE UPDATE OF capacidad ON rooms
  FOR EACH ROW EXECUTE FUNCTION validar_reduccion_capacidad();

-- 8. stay_guests
CREATE TABLE IF NOT EXISTS stay_guests (
  id                   bigserial PRIMARY KEY,
  estancia_id          bigint    NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  huesped_id           bigint    NOT NULL REFERENCES guests(id),
  es_huesped_principal bool      NOT NULL DEFAULT false,
  tipo_ocupante        text      NOT NULL DEFAULT 'adulto' CHECK (tipo_ocupante IN ('adulto','nino')),
  relacion             text      NOT NULL DEFAULT '',
  relacion_otro        text      NOT NULL DEFAULT '',
  UNIQUE (estancia_id, huesped_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_principal_por_estancia ON stay_guests (estancia_id) WHERE es_huesped_principal = true;
ALTER TABLE stay_guests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION recalcular_ocupantes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eid       bigint;
  v_adultos   int; v_ninos int; v_total int; v_cap int;
  v_principal bigint; v_stay_hid bigint;
BEGIN
  v_eid := COALESCE(NEW.estancia_id, OLD.estancia_id);
  SELECT
    COUNT(*) FILTER (WHERE tipo_ocupante = 'adulto'),
    COUNT(*) FILTER (WHERE tipo_ocupante = 'nino'),
    COUNT(*)
  INTO v_adultos, v_ninos, v_total FROM stay_guests WHERE estancia_id = v_eid;
  SELECT r.capacidad INTO v_cap FROM stays s JOIN rooms r ON r.id = s.habitacion_id WHERE s.id = v_eid;
  IF v_total > v_cap THEN
    RAISE EXCEPTION 'Capacidad excedida: la habitación admite % persona(s); se registran %.', v_cap, v_total;
  END IF;
  SELECT huesped_id INTO v_principal FROM stay_guests WHERE estancia_id = v_eid AND es_huesped_principal = true;
  SELECT huesped_id INTO v_stay_hid FROM stays WHERE id = v_eid;
  IF v_principal IS NOT NULL AND v_principal <> v_stay_hid THEN
    RAISE EXCEPTION 'El huésped principal en stay_guests (%) no coincide con stays.huesped_id (%).', v_principal, v_stay_hid;
  END IF;
  UPDATE stays SET adultos = GREATEST(v_adultos,0), ninos = GREATEST(v_ninos,0), total_ocupantes = GREATEST(v_total,1) WHERE id = v_eid;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trig_recalcular_ocupantes ON stay_guests;
CREATE TRIGGER trig_recalcular_ocupantes AFTER INSERT OR UPDATE OR DELETE ON stay_guests
  FOR EACH ROW EXECUTE FUNCTION recalcular_ocupantes();

-- 9. payments
CREATE TABLE IF NOT EXISTS payments (
  id          bigserial     PRIMARY KEY,
  estancia_id bigint        NOT NULL REFERENCES stays(id),
  monto       numeric(12,2) NOT NULL CHECK (monto > 0),
  metodo_pago text          NOT NULL CHECK (metodo_pago IN ('Efectivo','Tarjeta','Transferencia','Nequi','Daviplata')),
  tipo        text          NOT NULL CHECK (tipo IN ('anticipo','saldo')),
  referencia  text          NOT NULL DEFAULT '',
  fecha       date          NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  created_by  uuid          REFERENCES profiles(id),
  es_demo     bool          NOT NULL DEFAULT false
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 10. tra_submissions
CREATE TABLE IF NOT EXISTS tra_submissions (
  id                   bigserial   PRIMARY KEY,
  grupo_id             text        NOT NULL,
  estancia_id          bigint      REFERENCES stays(id),
  huesped_id           bigint      NOT NULL REFERENCES guests(id),
  habitacion_id        bigint      NOT NULL REFERENCES rooms(id),
  es_huesped_principal bool        NOT NULL DEFAULT false,
  ciudad_procedencia   text        NOT NULL DEFAULT '',
  motivo_viaje         text        NOT NULL DEFAULT 'Turismo'
    CHECK (motivo_viaje IN ('Turismo','Negocios','Trabajo','Salud','Visita familiar','Eventos','Tránsito','Otro')),
  check_in_at          timestamptz NOT NULL,
  check_out_at         timestamptz,
  estado_registro      text        NOT NULL DEFAULT 'borrador'
    CHECK (estado_registro IN ('borrador','activo','checkout_realizado','pendiente','enviando','enviado','error','requiere_revision','anulado')),
  motivo_anulacion     text        NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid        REFERENCES profiles(id),
  updated_by           uuid        REFERENCES profiles(id),
  es_demo              bool        NOT NULL DEFAULT false,
  CONSTRAINT tra_anulacion_requiere_motivo CHECK (estado_registro <> 'anulado' OR motivo_anulacion <> '')
);
ALTER TABLE tra_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trig_tra_updated_at ON tra_submissions;
CREATE TRIGGER trig_tra_updated_at BEFORE UPDATE ON tra_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. export_audit_logs
CREATE TABLE IF NOT EXISTS export_audit_logs (
  id            bigserial   PRIMARY KEY,
  usuario_id    uuid        REFERENCES profiles(id),
  tipo_reporte  text        NOT NULL,
  filtros       jsonb       NOT NULL DEFAULT '{}',
  num_registros int         NOT NULL DEFAULT 0,
  generado_en   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE export_audit_logs ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- FUNCIONES SEGURAS
-- ================================================================

CREATE OR REPLACE FUNCTION actualizar_estado_habitacion(p_room_id bigint, p_estado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text; v_activo boolean; v_anterior text;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol NOT IN ('administrador','recepcion') THEN
    RAISE EXCEPTION 'No autorizado para actualizar el estado de habitaciones.';
  END IF;
  IF p_estado NOT IN ('Disponible','Ocupada','Limpieza','Mantenimiento') THEN
    RAISE EXCEPTION 'Estado inválido: %.', p_estado;
  END IF;
  SELECT estado INTO v_anterior FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Habitación % no encontrada.', p_room_id; END IF;
  UPDATE rooms SET estado = p_estado WHERE id = p_room_id;
  INSERT INTO room_state_logs (room_id, estado_antes, estado_nuevo, usuario_id)
  VALUES (p_room_id, v_anterior, p_estado, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION actualizar_estado_habitacion(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION actualizar_estado_habitacion(bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION crear_check_in(
  p_huesped_id            bigint,
  p_habitacion_id         bigint,
  p_fecha_ingreso         timestamptz,
  p_fecha_salida_estimada timestamptz,
  p_valor_persona_noche   numeric,
  p_metodo_pago           text,
  p_observaciones         text  DEFAULT '',
  p_ciudad_procedencia    text  DEFAULT '',
  p_motivo_viaje          text  DEFAULT 'Turismo',
  p_acompanantes          jsonb DEFAULT '[]'::jsonb
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text; v_activo boolean; v_habitacion rooms%ROWTYPE; v_guest_existe bool;
  v_stay_id bigint; v_total_ocup int; v_grupo_id text;
  v_acomp jsonb; v_acomp_hid bigint; v_tipo_ocup text; v_relacion text; v_relacion_otro text;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol NOT IN ('administrador','recepcion') THEN
    RAISE EXCEPTION 'No autorizado para realizar check-in.';
  END IF;
  SELECT EXISTS (SELECT 1 FROM guests WHERE id = p_huesped_id) INTO v_guest_existe;
  IF NOT v_guest_existe THEN RAISE EXCEPTION 'Huésped principal % no encontrado.', p_huesped_id; END IF;
  SELECT * INTO v_habitacion FROM rooms WHERE id = p_habitacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Habitación % no encontrada.', p_habitacion_id; END IF;
  IF v_habitacion.estado <> 'Disponible' THEN
    RAISE EXCEPTION 'La habitación % no está disponible. Estado actual: %.', v_habitacion.numero, v_habitacion.estado;
  END IF;
  IF p_fecha_salida_estimada <= p_fecha_ingreso THEN
    RAISE EXCEPTION 'La fecha de salida estimada debe ser posterior al ingreso.';
  END IF;
  v_total_ocup := 1 + jsonb_array_length(p_acompanantes);
  IF v_total_ocup > v_habitacion.capacidad THEN
    RAISE EXCEPTION 'Capacidad excedida: la habitación % admite % persona(s); se registran %.', v_habitacion.numero, v_habitacion.capacidad, v_total_ocup;
  END IF;
  IF p_metodo_pago NOT IN ('Efectivo','Tarjeta','Transferencia','Nequi','Daviplata') THEN
    RAISE EXCEPTION 'Método de pago inválido: %.', p_metodo_pago;
  END IF;
  IF p_motivo_viaje NOT IN ('Turismo','Negocios','Trabajo','Salud','Visita familiar','Eventos','Tránsito','Otro') THEN
    RAISE EXCEPTION 'Motivo de viaje inválido: %.', p_motivo_viaje;
  END IF;
  INSERT INTO stays (
    huesped_id, habitacion_id, usuario_id, fecha_ingreso, fecha_salida_estimada,
    adultos, ninos, total_ocupantes, valor_persona_noche, metodo_pago,
    observaciones, estado, es_demo
  ) VALUES (
    p_huesped_id, p_habitacion_id, auth.uid(), p_fecha_ingreso, p_fecha_salida_estimada,
    1, 0, v_total_ocup, p_valor_persona_noche, p_metodo_pago,
    trim(p_observaciones), 'activa', false
  ) RETURNING id INTO v_stay_id;
  INSERT INTO stay_guests (estancia_id, huesped_id, es_huesped_principal, tipo_ocupante)
  VALUES (v_stay_id, p_huesped_id, true, 'adulto');
  FOR v_acomp IN SELECT * FROM jsonb_array_elements(p_acompanantes) LOOP
    v_acomp_hid     := (v_acomp->>'huesped_id')::bigint;
    v_tipo_ocup     := COALESCE(v_acomp->>'tipo_ocupante', 'adulto');
    v_relacion      := COALESCE(v_acomp->>'relacion', '');
    v_relacion_otro := COALESCE(v_acomp->>'relacion_otro', '');
    IF NOT EXISTS (SELECT 1 FROM guests WHERE id = v_acomp_hid) THEN
      RAISE EXCEPTION 'Acompañante % no encontrado en guests.', v_acomp_hid;
    END IF;
    IF v_tipo_ocup NOT IN ('adulto','nino') THEN
      RAISE EXCEPTION 'tipo_ocupante inválido: %.', v_tipo_ocup;
    END IF;
    INSERT INTO stay_guests (estancia_id, huesped_id, es_huesped_principal, tipo_ocupante, relacion, relacion_otro)
    VALUES (v_stay_id, v_acomp_hid, false, v_tipo_ocup, v_relacion, v_relacion_otro);
  END LOOP;
  v_grupo_id := gen_random_uuid()::text;
  INSERT INTO tra_submissions (
    grupo_id, estancia_id, huesped_id, habitacion_id, es_huesped_principal,
    ciudad_procedencia, motivo_viaje, check_in_at, estado_registro,
    created_by, updated_by, es_demo
  ) VALUES (
    v_grupo_id, v_stay_id, p_huesped_id, p_habitacion_id, true,
    trim(p_ciudad_procedencia), p_motivo_viaje, p_fecha_ingreso,
    CASE WHEN trim(p_ciudad_procedencia) <> '' THEN 'activo' ELSE 'borrador' END,
    auth.uid(), auth.uid(), false
  );
  FOR v_acomp IN SELECT * FROM jsonb_array_elements(p_acompanantes) LOOP
    INSERT INTO tra_submissions (
      grupo_id, estancia_id, huesped_id, habitacion_id, es_huesped_principal,
      ciudad_procedencia, motivo_viaje, check_in_at, estado_registro,
      created_by, updated_by, es_demo
    ) VALUES (
      v_grupo_id, v_stay_id, (v_acomp->>'huesped_id')::bigint, p_habitacion_id, false,
      trim(p_ciudad_procedencia), p_motivo_viaje, p_fecha_ingreso,
      CASE WHEN trim(p_ciudad_procedencia) <> '' THEN 'activo' ELSE 'borrador' END,
      auth.uid(), auth.uid(), false
    );
  END LOOP;
  PERFORM actualizar_estado_habitacion(p_habitacion_id, 'Ocupada');
  RETURN v_stay_id;
END;
$$;
REVOKE ALL ON FUNCTION crear_check_in(bigint,bigint,timestamptz,timestamptz,numeric,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crear_check_in(bigint,bigint,timestamptz,timestamptz,numeric,text,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION registrar_pago(
  p_estancia_id bigint, p_monto numeric, p_metodo_pago text, p_tipo text, p_referencia text DEFAULT ''
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text; v_activo boolean; v_estado text; v_total numeric; v_pagado numeric; v_pago_id bigint;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol NOT IN ('administrador','recepcion') THEN
    RAISE EXCEPTION 'No autorizado para registrar pagos.';
  END IF;
  IF p_monto <= 0 THEN RAISE EXCEPTION 'El monto del pago debe ser mayor a cero.'; END IF;
  IF p_metodo_pago NOT IN ('Efectivo','Tarjeta','Transferencia','Nequi','Daviplata') THEN
    RAISE EXCEPTION 'Método de pago inválido: %.', p_metodo_pago;
  END IF;
  IF p_tipo NOT IN ('anticipo','saldo') THEN RAISE EXCEPTION 'Tipo de pago inválido: %.', p_tipo; END IF;
  SELECT estado, total INTO v_estado, v_total FROM stays WHERE id = p_estancia_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estadía % no encontrada.', p_estancia_id; END IF;
  IF v_estado = 'anulada' THEN RAISE EXCEPTION 'No se pueden registrar pagos en una estadía anulada.'; END IF;
  SELECT COALESCE(SUM(monto), 0) INTO v_pagado FROM payments WHERE estancia_id = p_estancia_id;
  IF v_total IS NOT NULL AND (v_pagado + p_monto) > v_total THEN
    RAISE EXCEPTION 'El pago (%) supera el saldo pendiente (total: %, ya pagado: %).', p_monto, v_total, v_pagado;
  END IF;
  INSERT INTO payments (estancia_id, monto, metodo_pago, tipo, referencia, fecha, created_at, created_by, es_demo)
  VALUES (p_estancia_id, p_monto, p_metodo_pago, p_tipo, trim(p_referencia), CURRENT_DATE, now(), auth.uid(), false)
  RETURNING id INTO v_pago_id;
  RETURN v_pago_id;
END;
$$;
REVOKE ALL ON FUNCTION registrar_pago(bigint, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_pago(bigint, numeric, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION finalizar_check_out(
  p_stay_id bigint, p_fecha_salida_real timestamptz, p_observaciones_salida text DEFAULT ''
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text; v_activo boolean; v_stay stays%ROWTYPE;
  v_fecha_ingreso_local date; v_fecha_salida_local date; v_hora_salida_local time;
  v_noches_base int; v_noches_final int;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol NOT IN ('administrador','recepcion') THEN
    RAISE EXCEPTION 'No autorizado para realizar check-out.';
  END IF;
  SELECT * INTO v_stay FROM stays WHERE id = p_stay_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estadía % no encontrada.', p_stay_id; END IF;
  IF v_stay.estado <> 'activa' THEN
    RAISE EXCEPTION 'Solo se puede hacer check-out de una estadía activa. Estado actual: %.', v_stay.estado;
  END IF;
  IF p_fecha_salida_real <= v_stay.fecha_ingreso THEN
    RAISE EXCEPTION 'La fecha de salida debe ser posterior a la fecha de ingreso.';
  END IF;
  v_fecha_ingreso_local := (v_stay.fecha_ingreso AT TIME ZONE 'America/Bogota')::date;
  v_fecha_salida_local  := (p_fecha_salida_real  AT TIME ZONE 'America/Bogota')::date;
  v_hora_salida_local   := (p_fecha_salida_real  AT TIME ZONE 'America/Bogota')::time;
  v_noches_base  := GREATEST(1, (v_fecha_salida_local - v_fecha_ingreso_local));
  v_noches_final := GREATEST(1, v_noches_base + CASE WHEN v_hora_salida_local > TIME '16:00:00' THEN 1 ELSE 0 END);
  UPDATE stays SET
    fecha_salida_real = p_fecha_salida_real, noches = v_noches_final,
    observaciones_salida = trim(p_observaciones_salida), estado = 'finalizada'
  WHERE id = p_stay_id;
  PERFORM actualizar_estado_habitacion(v_stay.habitacion_id, 'Limpieza');
  UPDATE tra_submissions SET
    estado_registro = 'checkout_realizado', check_out_at = p_fecha_salida_real,
    updated_by = auth.uid(), updated_at = now()
  WHERE estancia_id = p_stay_id AND estado_registro IN ('borrador','activo');
END;
$$;
REVOKE ALL ON FUNCTION finalizar_check_out(bigint, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalizar_check_out(bigint, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION actualizar_estancia_activa(
  p_stay_id bigint, p_fecha_salida_estimada timestamptz DEFAULT NULL,
  p_metodo_pago text DEFAULT NULL, p_observaciones text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text; v_activo boolean; v_stay stays%ROWTYPE;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol NOT IN ('administrador','recepcion') THEN
    RAISE EXCEPTION 'No autorizado para actualizar estadías.';
  END IF;
  SELECT * INTO v_stay FROM stays WHERE id = p_stay_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estadía % no encontrada.', p_stay_id; END IF;
  IF v_stay.estado <> 'activa' THEN
    RAISE EXCEPTION 'Solo se pueden modificar estadías activas. Estado actual: %.', v_stay.estado;
  END IF;
  IF p_fecha_salida_estimada IS NOT NULL AND p_fecha_salida_estimada <= v_stay.fecha_ingreso THEN
    RAISE EXCEPTION 'La fecha de salida estimada debe ser posterior al ingreso.';
  END IF;
  IF p_metodo_pago IS NOT NULL AND p_metodo_pago NOT IN ('Efectivo','Tarjeta','Transferencia','Nequi','Daviplata') THEN
    RAISE EXCEPTION 'Método de pago inválido: %.', p_metodo_pago;
  END IF;
  UPDATE stays SET
    fecha_salida_estimada = COALESCE(p_fecha_salida_estimada, fecha_salida_estimada),
    metodo_pago           = COALESCE(p_metodo_pago, metodo_pago),
    observaciones         = COALESCE(p_observaciones, observaciones)
  WHERE id = p_stay_id;
END;
$$;
REVOKE ALL ON FUNCTION actualizar_estancia_activa(bigint, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION actualizar_estancia_activa(bigint, timestamptz, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION anular_estancia(p_stay_id bigint, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text; v_activo boolean; v_stay stays%ROWTYPE;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol <> 'administrador' THEN
    RAISE EXCEPTION 'Solo administradores activos pueden anular estadías.';
  END IF;
  IF trim(p_motivo) = '' THEN RAISE EXCEPTION 'El motivo de anulación es obligatorio.'; END IF;
  SELECT * INTO v_stay FROM stays WHERE id = p_stay_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estadía % no encontrada.', p_stay_id; END IF;
  IF v_stay.estado <> 'activa' THEN
    RAISE EXCEPTION 'Solo se pueden anular estadías activas. Estado actual: %.', v_stay.estado;
  END IF;
  UPDATE stays SET estado = 'anulada', anulado_en = now(), anulado_por = auth.uid(),
    motivo_anulacion = trim(p_motivo) WHERE id = p_stay_id;
  PERFORM actualizar_estado_habitacion(v_stay.habitacion_id, 'Disponible');
  UPDATE tra_submissions SET
    estado_registro = 'anulado', motivo_anulacion = 'Estadía anulada: ' || trim(p_motivo),
    updated_by = auth.uid(), updated_at = now()
  WHERE estancia_id = p_stay_id AND estado_registro <> 'enviado';
END;
$$;
REVOKE ALL ON FUNCTION anular_estancia(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anular_estancia(bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION actualizar_registro_tra_borrador(
  p_id bigint, p_ciudad_procedencia text DEFAULT NULL, p_motivo_viaje text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text; v_activo boolean; v_estado text;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol NOT IN ('administrador','recepcion') THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;
  SELECT estado_registro INTO v_estado FROM tra_submissions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro TRA % no encontrado.', p_id; END IF;
  IF v_estado NOT IN ('borrador','activo','requiere_revision') THEN
    RAISE EXCEPTION 'No se puede editar un registro TRA en estado "%".', v_estado;
  END IF;
  UPDATE tra_submissions SET
    ciudad_procedencia = COALESCE(p_ciudad_procedencia, ciudad_procedencia),
    motivo_viaje       = COALESCE(p_motivo_viaje, motivo_viaje),
    updated_by = auth.uid(), updated_at = now()
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION actualizar_registro_tra_borrador(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION actualizar_registro_tra_borrador(bigint, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION anular_registro_tra(p_id bigint, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text; v_activo boolean; v_estado text;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol <> 'administrador' THEN
    RAISE EXCEPTION 'Solo administradores pueden anular registros TRA.';
  END IF;
  IF trim(p_motivo) = '' THEN RAISE EXCEPTION 'El motivo de anulación es obligatorio.'; END IF;
  SELECT estado_registro INTO v_estado FROM tra_submissions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro TRA % no encontrado.', p_id; END IF;
  IF v_estado = 'enviado' THEN RAISE EXCEPTION 'No se puede anular un registro TRA ya enviado al MinCIT.'; END IF;
  UPDATE tra_submissions SET estado_registro = 'anulado', motivo_anulacion = trim(p_motivo),
    updated_by = auth.uid(), updated_at = now()
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION anular_registro_tra(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anular_registro_tra(bigint, text) TO authenticated;

-- ================================================================
-- marcar_envio_tra  — USO EXCLUSIVO DE BACKEND / EDGE FUNCTION.
-- NUNCA debe exponerse al frontend ni llamarse desde el cliente.
-- Solo puede ejecutarla el cliente Supabase con service_role
-- desde la Edge Function: supabaseAdmin.rpc('marcar_envio_tra', {...})
-- No se otorga GRANT a 'authenticated' ni a ningún rol de usuario.
-- ================================================================
CREATE OR REPLACE FUNCTION marcar_envio_tra(p_id bigint, p_estado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_estado NOT IN ('pendiente','enviando','enviado','error') THEN
    RAISE EXCEPTION 'Estado de envío inválido: %', p_estado;
  END IF;
  UPDATE tra_submissions SET estado_registro = p_estado, updated_at = now() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION marcar_envio_tra(bigint, text) FROM PUBLIC;
-- Sin GRANT a authenticated — solo service_role puede invocar desde Edge Function.

CREATE OR REPLACE FUNCTION limpiar_datos_demo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text; v_activo boolean; v_conflictos jsonb := '[]'::jsonb;
  v_n_tra int := 0; v_n_payments int := 0; v_n_stays int := 0;
  v_n_guests int := 0; v_n_rooms int := 0; r RECORD;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_activo OR v_rol <> 'administrador' THEN
    RAISE EXCEPTION 'Solo administradores activos pueden limpiar datos de demostración.';
  END IF;
  FOR r IN SELECT ro.id, ro.numero AS detalle, 'habitacion_demo_con_estancia_real' AS tipo
    FROM rooms ro WHERE ro.es_demo = true
      AND EXISTS (SELECT 1 FROM stays s WHERE s.habitacion_id = ro.id AND s.es_demo = false)
  LOOP
    v_conflictos := v_conflictos || jsonb_build_object('tipo',r.tipo,'id',r.id,'detalle',r.detalle);
  END LOOP;
  FOR r IN SELECT g.id, g.primer_nombre||' '||g.primer_apellido AS detalle, 'huesped_demo_en_estancia_real' AS tipo
    FROM guests g WHERE g.es_demo = true
      AND EXISTS (SELECT 1 FROM stays s WHERE s.huesped_id = g.id AND s.es_demo = false)
  LOOP
    v_conflictos := v_conflictos || jsonb_build_object('tipo',r.tipo,'id',r.id,'detalle',r.detalle);
  END LOOP;
  FOR r IN SELECT g.id, g.primer_nombre||' '||g.primer_apellido AS detalle, 'huesped_demo_acompanante_real' AS tipo
    FROM guests g WHERE g.es_demo = true
      AND EXISTS (SELECT 1 FROM stay_guests sg JOIN stays s ON s.id = sg.estancia_id
                  WHERE sg.huesped_id = g.id AND s.es_demo = false)
  LOOP
    v_conflictos := v_conflictos || jsonb_build_object('tipo',r.tipo,'id',r.id,'detalle',r.detalle);
  END LOOP;
  FOR r IN SELECT g.id, g.primer_nombre||' '||g.primer_apellido AS detalle, 'huesped_demo_en_tra_real' AS tipo
    FROM guests g WHERE g.es_demo = true
      AND EXISTS (SELECT 1 FROM tra_submissions t WHERE t.huesped_id = g.id AND t.es_demo = false)
  LOOP
    v_conflictos := v_conflictos || jsonb_build_object('tipo',r.tipo,'id',r.id,'detalle',r.detalle);
  END LOOP;
  FOR r IN SELECT s.id, 'Estadía demo #'||s.id AS detalle, 'estancia_demo_con_tra_real' AS tipo
    FROM stays s WHERE s.es_demo = true
      AND EXISTS (SELECT 1 FROM tra_submissions t WHERE t.estancia_id = s.id AND t.es_demo = false)
  LOOP
    v_conflictos := v_conflictos || jsonb_build_object('tipo',r.tipo,'id',r.id,'detalle',r.detalle);
  END LOOP;
  FOR r IN SELECT s.id, 'Estadía demo #'||s.id AS detalle, 'estancia_demo_con_pago_real' AS tipo
    FROM stays s WHERE s.es_demo = true
      AND EXISTS (SELECT 1 FROM payments p WHERE p.estancia_id = s.id AND p.es_demo = false)
  LOOP
    v_conflictos := v_conflictos || jsonb_build_object('tipo',r.tipo,'id',r.id,'detalle',r.detalle);
  END LOOP;
  IF jsonb_array_length(v_conflictos) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Existen dependencias entre datos demo y reales.', 'conflictos', v_conflictos);
  END IF;
  DELETE FROM tra_submissions
  WHERE es_demo = true AND (estancia_id IS NULL OR estancia_id IN (SELECT id FROM stays WHERE es_demo = true));
  GET DIAGNOSTICS v_n_tra = ROW_COUNT;
  DELETE FROM payments WHERE es_demo = true OR estancia_id IN (SELECT id FROM stays WHERE es_demo = true);
  GET DIAGNOSTICS v_n_payments = ROW_COUNT;
  DELETE FROM stays WHERE es_demo = true;
  GET DIAGNOSTICS v_n_stays = ROW_COUNT;
  DELETE FROM guests WHERE es_demo = true;
  GET DIAGNOSTICS v_n_guests = ROW_COUNT;
  DELETE FROM rooms WHERE es_demo = true;
  GET DIAGNOSTICS v_n_rooms = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'tra', v_n_tra, 'payments', v_n_payments, 'stays', v_n_stays, 'guests', v_n_guests, 'rooms', v_n_rooms);
END;
$$;
REVOKE ALL ON FUNCTION limpiar_datos_demo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION limpiar_datos_demo() TO authenticated;

-- ================================================================
-- POLÍTICAS RLS
-- ================================================================

CREATE POLICY "profiles: admin ve todos" ON profiles FOR SELECT TO authenticated USING (mi_rol() = 'administrador');
CREATE POLICY "profiles: usuario activo ve el suyo" ON profiles FOR SELECT TO authenticated USING (id = auth.uid() AND mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "profiles: solo admin inserta" ON profiles FOR INSERT TO authenticated WITH CHECK (mi_rol() = 'administrador');
CREATE POLICY "profiles: solo admin actualiza" ON profiles FOR UPDATE TO authenticated USING (mi_rol() = 'administrador') WITH CHECK (mi_rol() = 'administrador');
CREATE POLICY "profiles: nadie borra" ON profiles FOR DELETE TO authenticated USING (false);

CREATE POLICY "rooms: usuarios activos ven" ON rooms FOR SELECT TO authenticated USING (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "rooms: solo admin crea" ON rooms FOR INSERT TO authenticated WITH CHECK (mi_rol() = 'administrador');
CREATE POLICY "rooms: solo admin actualiza" ON rooms FOR UPDATE TO authenticated USING (mi_rol() = 'administrador') WITH CHECK (mi_rol() = 'administrador');
CREATE POLICY "rooms: nadie borra" ON rooms FOR DELETE TO authenticated USING (false);

CREATE POLICY "room_logs: admin ve todos" ON room_state_logs FOR SELECT TO authenticated USING (mi_rol() = 'administrador');
CREATE POLICY "room_logs: nadie inserta directamente" ON room_state_logs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "room_logs: nadie modifica" ON room_state_logs FOR UPDATE TO authenticated USING (false);
CREATE POLICY "room_logs: nadie borra" ON room_state_logs FOR DELETE TO authenticated USING (false);

CREATE POLICY "guests: usuarios activos ven" ON guests FOR SELECT TO authenticated USING (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "guests: usuarios activos crean" ON guests FOR INSERT TO authenticated WITH CHECK (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "guests: usuarios activos actualizan" ON guests FOR UPDATE TO authenticated USING (mi_rol() IN ('administrador','recepcion')) WITH CHECK (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "guests: solo admin borra" ON guests FOR DELETE TO authenticated USING (mi_rol() = 'administrador');

CREATE POLICY "stays: usuarios activos ven" ON stays FOR SELECT TO authenticated USING (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "stays: nadie crea directamente" ON stays FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "stays: nadie actualiza directamente" ON stays FOR UPDATE TO authenticated USING (false);
CREATE POLICY "stays: nadie elimina" ON stays FOR DELETE TO authenticated USING (false);

CREATE POLICY "stay_guests: usuarios activos ven" ON stay_guests FOR SELECT TO authenticated USING (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "stay_guests: nadie inserta directamente" ON stay_guests FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "stay_guests: nadie actualiza directamente" ON stay_guests FOR UPDATE TO authenticated USING (false);
CREATE POLICY "stay_guests: nadie borra directamente" ON stay_guests FOR DELETE TO authenticated USING (false);

CREATE POLICY "payments: usuarios activos ven" ON payments FOR SELECT TO authenticated USING (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "payments: nadie inserta directamente" ON payments FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "payments: nadie modifica" ON payments FOR UPDATE TO authenticated USING (false);
CREATE POLICY "payments: nadie borra" ON payments FOR DELETE TO authenticated USING (false);

CREATE POLICY "tra: usuarios activos ven" ON tra_submissions FOR SELECT TO authenticated USING (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "tra: nadie inserta directamente" ON tra_submissions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "tra: nadie actualiza directamente" ON tra_submissions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "tra: nadie borra" ON tra_submissions FOR DELETE TO authenticated USING (false);

CREATE POLICY "audit: admin ve todos" ON export_audit_logs FOR SELECT TO authenticated USING (mi_rol() = 'administrador');
CREATE POLICY "audit: usuarios activos insertan" ON export_audit_logs FOR INSERT TO authenticated WITH CHECK (mi_rol() IN ('administrador','recepcion'));
CREATE POLICY "audit: nadie modifica" ON export_audit_logs FOR UPDATE TO authenticated USING (false);
CREATE POLICY "audit: nadie borra" ON export_audit_logs FOR DELETE TO authenticated USING (false);
