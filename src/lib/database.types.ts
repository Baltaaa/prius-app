export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caja_diaria: {
        Row: {
          abierta_at: string | null
          abierta_por: string | null
          cerrada: boolean | null
          cerrada_at: string | null
          cerrada_por: string | null
          created_at: string | null
          diferencia: number | null
          efectivo: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          estado: string
          fecha: string | null
          id: string
          medio_pago_1: number | null
          medio_pago_2: number | null
          notas: string | null
          observaciones_cierre: string | null
          resumen_snapshot: Json | null
          saldo_apertura: number | null
          temporada_id: string | null
          total_cobros: number | null
          total_gastos: number | null
          total_neto: number | null
          z_cantidad_comprobantes: number | null
          z_fecha: string | null
          z_iva: number | null
          z_neto_gravado: number | null
          z_numero: string | null
          z_primer_comprobante: string | null
          z_total: number | null
          z_ultimo_comprobante: string | null
        }
        Insert: {
          abierta_at?: string | null
          abierta_por?: string | null
          cerrada?: boolean | null
          cerrada_at?: string | null
          cerrada_por?: string | null
          created_at?: string | null
          diferencia?: number | null
          efectivo?: number | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          estado?: string
          fecha?: string | null
          id?: string
          medio_pago_1?: number | null
          medio_pago_2?: number | null
          notas?: string | null
          observaciones_cierre?: string | null
          resumen_snapshot?: Json | null
          saldo_apertura?: number | null
          temporada_id?: string | null
          total_cobros?: number | null
          total_gastos?: number | null
          total_neto?: number | null
          z_cantidad_comprobantes?: number | null
          z_fecha?: string | null
          z_iva?: number | null
          z_neto_gravado?: number | null
          z_numero?: string | null
          z_primer_comprobante?: string | null
          z_total?: number | null
          z_ultimo_comprobante?: string | null
        }
        Update: {
          abierta_at?: string | null
          abierta_por?: string | null
          cerrada?: boolean | null
          cerrada_at?: string | null
          cerrada_por?: string | null
          created_at?: string | null
          diferencia?: number | null
          efectivo?: number | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          estado?: string
          fecha?: string | null
          id?: string
          medio_pago_1?: number | null
          medio_pago_2?: number | null
          notas?: string | null
          observaciones_cierre?: string | null
          resumen_snapshot?: Json | null
          saldo_apertura?: number | null
          temporada_id?: string | null
          total_cobros?: number | null
          total_gastos?: number | null
          total_neto?: number | null
          z_cantidad_comprobantes?: number | null
          z_fecha?: string | null
          z_iva?: number | null
          z_neto_gravado?: number | null
          z_numero?: string | null
          z_primer_comprobante?: string | null
          z_total?: number | null
          z_ultimo_comprobante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_diaria_temporada_id_fkey"
            columns: ["temporada_id"]
            isOneToOne: false
            referencedRelation: "temporadas"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_eventos: {
        Row: {
          caja_id: string
          created_at: string
          detalle: Json | null
          id: string
          tipo: string
          usuario: string | null
        }
        Insert: {
          caja_id: string
          created_at?: string
          detalle?: Json | null
          id?: string
          tipo: string
          usuario?: string | null
        }
        Update: {
          caja_id?: string
          created_at?: string
          detalle?: Json | null
          id?: string
          tipo?: string
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_eventos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          apellido: string | null
          condicion_iva: string
          created_at: string | null
          created_by: string | null
          cuit: string | null
          cuit_valido: boolean | null
          dni: string | null
          id: string
          localidad: string | null
          mail: string | null
          nombre: string
          notas: string | null
          razon_social: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          condicion_iva?: string
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          cuit_valido?: boolean | null
          dni?: string | null
          id?: string
          localidad?: string | null
          mail?: string | null
          nombre: string
          notas?: string | null
          razon_social?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          condicion_iva?: string
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          cuit_valido?: boolean | null
          dni?: string | null
          id?: string
          localidad?: string | null
          mail?: string | null
          nombre?: string
          notas?: string | null
          razon_social?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clima_diario: {
        Row: {
          created_at: string
          fecha: string
          ocupacion_pct: number | null
          resumen: Json
        }
        Insert: {
          created_at?: string
          fecha: string
          ocupacion_pct?: number | null
          resumen: Json
        }
        Update: {
          created_at?: string
          fecha?: string
          ocupacion_pct?: number | null
          resumen?: Json
        }
        Relationships: []
      }
      clima_diario_pendiente: {
        Row: {
          created_at: string
          fecha: string
          ocupacion_pct: number | null
          request_id_forecast: number | null
          request_id_marine: number | null
        }
        Insert: {
          created_at?: string
          fecha: string
          ocupacion_pct?: number | null
          request_id_forecast?: number | null
          request_id_marine?: number | null
        }
        Update: {
          created_at?: string
          fecha?: string
          ocupacion_pct?: number | null
          request_id_forecast?: number | null
          request_id_marine?: number | null
        }
        Relationships: []
      }
      codigos_reserva: {
        Row: {
          checkin_at: string | null
          checkin_por: string | null
          codigo: string
          created_at: string
          lead_id: string | null
          metodo_pago_previsto: string | null
          unidades_contiguas: boolean
        }
        Insert: {
          checkin_at?: string | null
          checkin_por?: string | null
          codigo: string
          created_at?: string
          lead_id?: string | null
          metodo_pago_previsto?: string | null
          unidades_contiguas?: boolean
        }
        Update: {
          checkin_at?: string | null
          checkin_por?: string | null
          codigo?: string
          created_at?: string
          lead_id?: string | null
          metodo_pago_previsto?: string | null
          unidades_contiguas?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "codigos_reserva_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobantes: {
        Row: {
          cliente_id: string | null
          condicion_iva: string | null
          created_at: string
          created_by: string | null
          cuit: string | null
          estado: string
          fecha: string | null
          id: string
          monto_total: number | null
          numero: string
          pago_id: string | null
          punto_venta: number
          razon_social: string | null
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          condicion_iva?: string | null
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          estado?: string
          fecha?: string | null
          id?: string
          monto_total?: number | null
          numero: string
          pago_id?: string | null
          punto_venta?: number
          razon_social?: string | null
          tipo: string
        }
        Update: {
          cliente_id?: string | null
          condicion_iva?: string | null
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          estado?: string
          fecha?: string | null
          id?: string
          monto_total?: number | null
          numero?: string
          pago_id?: string | null
          punto_venta?: number
          razon_social?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      config_reservas_publicas: {
        Row: {
          activo: boolean
          dias_anticipacion_max: number
          hora_corte_noshow: string
          id: boolean
          max_reservas_activas_por_telefono: number
          max_unidades_por_reserva: number
          tipos_alquiler_web: string[]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          dias_anticipacion_max?: number
          hora_corte_noshow?: string
          id?: boolean
          max_reservas_activas_por_telefono?: number
          max_unidades_por_reserva?: number
          tipos_alquiler_web?: string[]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          dias_anticipacion_max?: number
          hora_corte_noshow?: string
          id?: boolean
          max_reservas_activas_por_telefono?: number
          max_unidades_por_reserva?: number
          tipos_alquiler_web?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          actor_nombre: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          datos: Json | null
          descripcion: string
          fecha_ref: string
          id: string
          operacion: string
          registro_id: string | null
          tabla: string
          tipo_evento: string | null
          ts: string
          usuario: string | null
        }
        Insert: {
          actor_nombre?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          datos?: Json | null
          descripcion: string
          fecha_ref: string
          id?: string
          operacion: string
          registro_id?: string | null
          tabla: string
          tipo_evento?: string | null
          ts?: string
          usuario?: string | null
        }
        Update: {
          actor_nombre?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          datos?: Json | null
          descripcion?: string
          fecha_ref?: string
          id?: string
          operacion?: string
          registro_id?: string | null
          tabla?: string
          tipo_evento?: string | null
          ts?: string
          usuario?: string | null
        }
        Relationships: []
      }
      gastos_caja: {
        Row: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string
          categoria: string
          comprobante_proveedor: string | null
          created_at: string | null
          descripcion: string
          estado: string
          id: string
          medio_pago: string
          monto: number
          proveedor: string | null
          registrado_por: string | null
        }
        Insert: {
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          caja_id: string
          categoria?: string
          comprobante_proveedor?: string | null
          created_at?: string | null
          descripcion: string
          estado?: string
          id?: string
          medio_pago?: string
          monto: number
          proveedor?: string | null
          registrado_por?: string | null
        }
        Update: {
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          caja_id?: string
          categoria?: string
          comprobante_proveedor?: string | null
          created_at?: string | null
          descripcion?: string
          estado?: string
          id?: string
          medio_pago?: string
          monto?: number
          proveedor?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_caja: {
        Row: {
          caja_id: string | null
          cliente_id: string | null
          concepto: string | null
          created_at: string | null
          es_efectivo: boolean
          id: string
          medio: string | null
          monto: number
          pago_id: string | null
          reserva_id: string | null
        }
        Insert: {
          caja_id?: string | null
          cliente_id?: string | null
          concepto?: string | null
          created_at?: string | null
          es_efectivo?: boolean
          id?: string
          medio?: string | null
          monto: number
          pago_id?: string | null
          reserva_id?: string | null
        }
        Update: {
          caja_id?: string | null
          cliente_id?: string | null
          concepto?: string | null
          created_at?: string | null
          es_efectivo?: boolean
          id?: string
          medio?: string | null
          monto?: number
          pago_id?: string | null
          reserva_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_caja_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_caja_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_caja_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_caja_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["reserva_id"]
          },
        ]
      }
      leads: {
        Row: {
          asunto: string
          created_at: string | null
          datos_form: Json | null
          email: string
          estado: string | null
          id: string
          mensaje: string | null
          motivo: string
          nombre: string
          notas_crm: string | null
          origen: string | null
          telefono: string
        }
        Insert: {
          asunto: string
          created_at?: string | null
          datos_form?: Json | null
          email: string
          estado?: string | null
          id?: string
          mensaje?: string | null
          motivo?: string
          nombre: string
          notas_crm?: string | null
          origen?: string | null
          telefono: string
        }
        Update: {
          asunto?: string
          created_at?: string | null
          datos_form?: Json | null
          email?: string
          estado?: string | null
          id?: string
          mensaje?: string | null
          motivo?: string
          nombre?: string
          notas_crm?: string | null
          origen?: string | null
          telefono?: string
        }
        Relationships: []
      }
      notificaciones_leidas: {
        Row: {
          leido_at: string
          notificacion_id: string
          usuario: string
        }
        Insert: {
          leido_at?: string
          notificacion_id: string
          usuario: string
        }
        Update: {
          leido_at?: string
          notificacion_id?: string
          usuario?: string
        }
        Relationships: []
      }
      pagos: {
        Row: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string | null
          cliente_id: string | null
          comprobante: string | null
          comprobante_id: string | null
          concepto: string | null
          created_at: string | null
          cuotas_tarjeta: number | null
          es_historico: boolean | null
          estado: string
          fecha: string | null
          fecha_hora: string
          id: string
          medio: string | null
          monto: number | null
          monto_pendiente_verificacion: boolean
          nro_cuota: number | null
          origen: string
          referencia: string | null
          registrado_por: string | null
          reserva_id: string | null
          tipo_pago: string | null
        }
        Insert: {
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          caja_id?: string | null
          cliente_id?: string | null
          comprobante?: string | null
          comprobante_id?: string | null
          concepto?: string | null
          created_at?: string | null
          cuotas_tarjeta?: number | null
          es_historico?: boolean | null
          estado?: string
          fecha?: string | null
          fecha_hora?: string
          id?: string
          medio?: string | null
          monto?: number | null
          monto_pendiente_verificacion?: boolean
          nro_cuota?: number | null
          origen?: string
          referencia?: string | null
          registrado_por?: string | null
          reserva_id?: string | null
          tipo_pago?: string | null
        }
        Update: {
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          caja_id?: string | null
          cliente_id?: string | null
          comprobante?: string | null
          comprobante_id?: string | null
          concepto?: string | null
          created_at?: string | null
          cuotas_tarjeta?: number | null
          es_historico?: boolean | null
          estado?: string
          fecha?: string | null
          fecha_hora?: string
          id?: string
          medio?: string | null
          monto?: number | null
          monto_pendiente_verificacion?: boolean
          nro_cuota?: number | null
          origen?: string
          referencia?: string | null
          registrado_por?: string | null
          reserva_id?: string | null
          tipo_pago?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_comprobante_id_fkey"
            columns: ["comprobante_id"]
            isOneToOne: false
            referencedRelation: "comprobantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["reserva_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          debe_cambiar_password: boolean
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at: string
          user_id: string
          usuario: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          debe_cambiar_password?: boolean
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
          user_id: string
          usuario: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          debe_cambiar_password?: boolean
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
          user_id?: string
          usuario?: string
        }
        Relationships: []
      }
      preferencias_usuario: {
        Row: {
          clave: string
          updated_at: string
          usuario: string
          valor: Json
        }
        Insert: {
          clave: string
          updated_at?: string
          usuario: string
          valor: Json
        }
        Update: {
          clave?: string
          updated_at?: string
          usuario?: string
          valor?: Json
        }
        Relationships: []
      }
      reserva_clientes: {
        Row: {
          cliente_id: string
          reserva_id: string
        }
        Insert: {
          cliente_id: string
          reserva_id: string
        }
        Update: {
          cliente_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_clientes_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_clientes_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["reserva_id"]
          },
        ]
      }
      reserva_grupos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          notas: string | null
          precio_total: number
          temporada: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          notas?: string | null
          precio_total: number
          temporada?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          notas?: string | null
          precio_total?: number
          temporada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserva_grupos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          ajuste: number
          ajuste_motivo: string | null
          bloqueada: boolean
          bonificada: boolean
          cantidad_personas: number | null
          cliente_id: string | null
          codigo: string | null
          created_at: string | null
          created_by: string | null
          estado: string
          estado_pago: string | null
          fecha: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          grupo_id: string | null
          id: string
          monto_grupo_referencia: number | null
          motivo_cancelacion: string | null
          notas: string | null
          numero_factura: string | null
          observaciones: string | null
          origen: string
          pendiente_verificacion: boolean
          precio_lista: number | null
          preconfirmada: boolean
          rango: unknown
          saldo: number | null
          temporada: string
          temporada_id: string | null
          tipo_alquiler: string | null
          unidad_id: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          ajuste?: number
          ajuste_motivo?: string | null
          bloqueada?: boolean
          bonificada?: boolean
          cantidad_personas?: number | null
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string | null
          created_by?: string | null
          estado?: string
          estado_pago?: string | null
          fecha?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          grupo_id?: string | null
          id?: string
          monto_grupo_referencia?: number | null
          motivo_cancelacion?: string | null
          notas?: string | null
          numero_factura?: string | null
          observaciones?: string | null
          origen?: string
          pendiente_verificacion?: boolean
          precio_lista?: number | null
          preconfirmada?: boolean
          rango: unknown
          saldo?: number | null
          temporada: string
          temporada_id?: string | null
          tipo_alquiler?: string | null
          unidad_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          ajuste?: number
          ajuste_motivo?: string | null
          bloqueada?: boolean
          bonificada?: boolean
          cantidad_personas?: number | null
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string | null
          created_by?: string | null
          estado?: string
          estado_pago?: string | null
          fecha?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          grupo_id?: string | null
          id?: string
          monto_grupo_referencia?: number | null
          motivo_cancelacion?: string | null
          notas?: string | null
          numero_factura?: string | null
          observaciones?: string | null
          origen?: string
          pendiente_verificacion?: boolean
          precio_lista?: number | null
          preconfirmada?: boolean
          rango?: unknown
          saldo?: number | null
          temporada?: string
          temporada_id?: string | null
          tipo_alquiler?: string | null
          unidad_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_codigo_fkey"
            columns: ["codigo"]
            isOneToOne: false
            referencedRelation: "codigos_reserva"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "reservas_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "reserva_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_temporada_id_fkey"
            columns: ["temporada_id"]
            isOneToOne: false
            referencedRelation: "temporadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          metodo_pago: string
          precio_fijo: number | null
          precio_por_dia: number | null
          tipo_alquiler: string
          tipo_unidad: string
          vigente_desde: string
          vigente_hasta: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          metodo_pago: string
          precio_fijo?: number | null
          precio_por_dia?: number | null
          tipo_alquiler: string
          tipo_unidad: string
          vigente_desde: string
          vigente_hasta: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          metodo_pago?: string
          precio_fijo?: number | null
          precio_por_dia?: number | null
          tipo_alquiler?: string
          tipo_unidad?: string
          vigente_desde?: string
          vigente_hasta?: string
        }
        Relationships: []
      }
      temporadas: {
        Row: {
          created_at: string
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          capacidad: number | null
          created_at: string | null
          estado: string | null
          fila: number | null
          habilitada_web: boolean
          id: string
          numero: number
          orden: number | null
          tipo: string
          zona: string | null
        }
        Insert: {
          capacidad?: number | null
          created_at?: string | null
          estado?: string | null
          fila?: number | null
          habilitada_web?: boolean
          id?: string
          numero: number
          orden?: number | null
          tipo: string
          zona?: string | null
        }
        Update: {
          capacidad?: number | null
          created_at?: string | null
          estado?: string | null
          fila?: number | null
          habilitada_web?: boolean
          id?: string
          numero?: number
          orden?: number | null
          tipo?: string
          zona?: string | null
        }
        Relationships: []
      }
      vistas_recientes: {
        Row: {
          entidad_id: string
          entidad_tipo: string
          id: string
          usuario: string
          visto_at: string
        }
        Insert: {
          entidad_id: string
          entidad_tipo: string
          id?: string
          usuario: string
          visto_at?: string
        }
        Update: {
          entidad_id?: string
          entidad_tipo?: string
          id?: string
          usuario?: string
          visto_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_caja_movimientos: {
        Row: {
          caja_id: string | null
          cliente_proveedor: string | null
          comprobante: string | null
          concepto: string | null
          estado: string | null
          fecha_hora: string | null
          medio_pago: string | null
          monto: number | null
          movimiento_id: string | null
          tipo_movimiento: string | null
          unidad: string | null
        }
        Relationships: []
      }
      v_reservas_saldo: {
        Row: {
          costo_total: number | null
          pagado: number | null
          reserva_id: string | null
          saldo: number | null
        }
        Insert: {
          costo_total?: number | null
          pagado?: never
          reserva_id?: string | null
          saldo?: number | null
        }
        Update: {
          costo_total?: number | null
          pagado?: never
          reserva_id?: string | null
          saldo?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      abrir_caja: {
        Args: { p_monto_inicial: number }
        Returns: {
          abierta_at: string | null
          abierta_por: string | null
          cerrada: boolean | null
          cerrada_at: string | null
          cerrada_por: string | null
          created_at: string | null
          diferencia: number | null
          efectivo: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          estado: string
          fecha: string | null
          id: string
          medio_pago_1: number | null
          medio_pago_2: number | null
          notas: string | null
          observaciones_cierre: string | null
          resumen_snapshot: Json | null
          saldo_apertura: number | null
          temporada_id: string | null
          total_cobros: number | null
          total_gastos: number | null
          total_neto: number | null
          z_cantidad_comprobantes: number | null
          z_fecha: string | null
          z_iva: number | null
          z_neto_gravado: number | null
          z_numero: string | null
          z_primer_comprobante: string | null
          z_total: number | null
          z_ultimo_comprobante: string | null
        }
        SetofOptions: {
          from: "*"
          to: "caja_diaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      anular_gasto: {
        Args: { p_gasto_id: string; p_motivo: string }
        Returns: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string
          categoria: string
          comprobante_proveedor: string | null
          created_at: string | null
          descripcion: string
          estado: string
          id: string
          medio_pago: string
          monto: number
          proveedor: string | null
          registrado_por: string | null
        }
        SetofOptions: {
          from: "*"
          to: "gastos_caja"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      anular_pago: {
        Args: { p_motivo: string; p_pago_id: string }
        Returns: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string | null
          cliente_id: string | null
          comprobante: string | null
          comprobante_id: string | null
          concepto: string | null
          created_at: string | null
          cuotas_tarjeta: number | null
          es_historico: boolean | null
          estado: string
          fecha: string | null
          fecha_hora: string
          id: string
          medio: string | null
          monto: number | null
          monto_pendiente_verificacion: boolean
          nro_cuota: number | null
          origen: string
          referencia: string | null
          registrado_por: string | null
          reserva_id: string | null
          tipo_pago: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pagos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      buscar_unidad_vecina: {
        Args: { p_desde: string; p_hasta: string; p_unidad: string }
        Returns: {
          contigua: boolean
          unidad_id: string
        }[]
      }
      cerrar_caja: {
        Args: {
          p_caja_id: string
          p_datos_z?: Json
          p_efectivo_contado: number
          p_observaciones?: string
        }
        Returns: {
          abierta_at: string | null
          abierta_por: string | null
          cerrada: boolean | null
          cerrada_at: string | null
          cerrada_por: string | null
          created_at: string | null
          diferencia: number | null
          efectivo: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          estado: string
          fecha: string | null
          id: string
          medio_pago_1: number | null
          medio_pago_2: number | null
          notas: string | null
          observaciones_cierre: string | null
          resumen_snapshot: Json | null
          saldo_apertura: number | null
          temporada_id: string | null
          total_cobros: number | null
          total_gastos: number | null
          total_neto: number | null
          z_cantidad_comprobantes: number | null
          z_fecha: string | null
          z_iva: number | null
          z_neto_gravado: number | null
          z_numero: string | null
          z_primer_comprobante: string | null
          z_total: number | null
          z_ultimo_comprobante: string | null
        }
        SetofOptions: {
          from: "*"
          to: "caja_diaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      completar_comprobante: {
        Args: { p_comprobante: Json; p_pago_id: string }
        Returns: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string | null
          cliente_id: string | null
          comprobante: string | null
          comprobante_id: string | null
          concepto: string | null
          created_at: string | null
          cuotas_tarjeta: number | null
          es_historico: boolean | null
          estado: string
          fecha: string | null
          fecha_hora: string
          id: string
          medio: string | null
          monto: number | null
          monto_pendiente_verificacion: boolean
          nro_cuota: number | null
          origen: string
          referencia: string | null
          registrado_por: string | null
          reserva_id: string | null
          tipo_pago: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pagos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cotizar: {
        Args: {
          p_desde: string
          p_hasta: string
          p_metodo: string
          p_tipo_alquiler: string
          p_tipo_unidad: string
        }
        Returns: number
      }
      crear_reserva: {
        Args: { p_clientes: string[]; p_pago_inicial?: Json; p_reserva: Json }
        Returns: {
          ajuste: number
          ajuste_motivo: string | null
          bloqueada: boolean
          bonificada: boolean
          cantidad_personas: number | null
          cliente_id: string | null
          codigo: string | null
          created_at: string | null
          created_by: string | null
          estado: string
          estado_pago: string | null
          fecha: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          grupo_id: string | null
          id: string
          monto_grupo_referencia: number | null
          motivo_cancelacion: string | null
          notas: string | null
          numero_factura: string | null
          observaciones: string | null
          origen: string
          pendiente_verificacion: boolean
          precio_lista: number | null
          preconfirmada: boolean
          rango: unknown
          saldo: number | null
          temporada: string
          temporada_id: string | null
          tipo_alquiler: string | null
          unidad_id: string | null
          updated_at: string
          valor_total: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reservas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cuit_valido: { Args: { p_cuit: string }; Returns: boolean }
      disponibilidad_publica: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          bloqueada: boolean
          capacidad: number
          fila: number
          numero: number
          orden: number
          tipo: string
          unidad_id: string
        }[]
      }
      editar_comprobante: {
        Args: { p_comprobante_id: string; p_fecha?: string; p_monto: number }
        Returns: {
          cliente_id: string | null
          condicion_iva: string | null
          created_at: string
          created_by: string | null
          cuit: string | null
          estado: string
          fecha: string | null
          id: string
          monto_total: number | null
          numero: string
          pago_id: string | null
          punto_venta: number
          razon_social: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "comprobantes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      es_admin: { Args: never; Returns: boolean }
      es_superadmin: { Args: never; Returns: boolean }
      fn_caja_inicio: { Args: never; Returns: string }
      fn_clima_diario_resolver: { Args: never; Returns: undefined }
      fn_clima_diario_solicitar: { Args: never; Returns: undefined }
      fn_comprobante_etiqueta: {
        Args: { c: Database["public"]["Tables"]["comprobantes"]["Row"] }
        Returns: string
      }
      fn_recalcula_totales_caja: {
        Args: { p_caja_id: string }
        Returns: undefined
      }
      fn_recalcular_estados_unidades: { Args: never; Returns: undefined }
      fn_registrar_pago_interno: {
        Args: {
          p_cliente_id: string
          p_comprobante: Json
          p_concepto: string
          p_fecha?: string
          p_medio: string
          p_monto: number
          p_permitir_excedente: boolean
          p_referencia: string
          p_reserva_id: string
          p_tipo_pago: string
        }
        Returns: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string | null
          cliente_id: string | null
          comprobante: string | null
          comprobante_id: string | null
          concepto: string | null
          created_at: string | null
          cuotas_tarjeta: number | null
          es_historico: boolean | null
          estado: string
          fecha: string | null
          fecha_hora: string
          id: string
          medio: string | null
          monto: number | null
          monto_pendiente_verificacion: boolean
          nro_cuota: number | null
          origen: string
          referencia: string | null
          registrado_por: string | null
          reserva_id: string | null
          tipo_pago: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pagos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_reserva_vigente: {
        Args: { r: Database["public"]["Tables"]["reservas"]["Row"] }
        Returns: boolean
      }
      generar_codigo_reserva: { Args: never; Returns: string }
      historial_entidad: {
        Args: {
          p_cursor?: string
          p_id?: string
          p_limit?: number
          p_tipo: string
          p_tipos_evento?: string[]
        }
        Returns: {
          actor_nombre: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          datos: Json | null
          descripcion: string
          fecha_ref: string
          id: string
          operacion: string
          registro_id: string | null
          tabla: string
          tipo_evento: string | null
          ts: string
          usuario: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "eventos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      marcar_password_cambiada: { Args: never; Returns: undefined }
      mover_unidad_temporada: {
        Args: {
          p_password: string
          p_reserva_id: string
          p_unidad_destino_id: string
        }
        Returns: {
          ajuste: number
          ajuste_motivo: string | null
          bloqueada: boolean
          bonificada: boolean
          cantidad_personas: number | null
          cliente_id: string | null
          codigo: string | null
          created_at: string | null
          created_by: string | null
          estado: string
          estado_pago: string | null
          fecha: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          grupo_id: string | null
          id: string
          monto_grupo_referencia: number | null
          motivo_cancelacion: string | null
          notas: string | null
          numero_factura: string | null
          observaciones: string | null
          origen: string
          pendiente_verificacion: boolean
          precio_lista: number | null
          preconfirmada: boolean
          rango: unknown
          saldo: number | null
          temporada: string
          temporada_id: string | null
          tipo_alquiler: string | null
          unidad_id: string | null
          updated_at: string
          valor_total: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reservas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reabrir_caja: {
        Args: { p_caja_id: string; p_motivo: string }
        Returns: {
          abierta_at: string | null
          abierta_por: string | null
          cerrada: boolean | null
          cerrada_at: string | null
          cerrada_por: string | null
          created_at: string | null
          diferencia: number | null
          efectivo: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          estado: string
          fecha: string | null
          id: string
          medio_pago_1: number | null
          medio_pago_2: number | null
          notas: string | null
          observaciones_cierre: string | null
          resumen_snapshot: Json | null
          saldo_apertura: number | null
          temporada_id: string | null
          total_cobros: number | null
          total_gastos: number | null
          total_neto: number | null
          z_cantidad_comprobantes: number | null
          z_fecha: string | null
          z_iva: number | null
          z_neto_gravado: number | null
          z_numero: string | null
          z_primer_comprobante: string | null
          z_total: number | null
          z_ultimo_comprobante: string | null
        }
        SetofOptions: {
          from: "*"
          to: "caja_diaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_gasto: {
        Args: {
          p_categoria: string
          p_comprobante_proveedor?: string
          p_concepto: string
          p_medio_pago: string
          p_monto: number
          p_proveedor?: string
        }
        Returns: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string
          categoria: string
          comprobante_proveedor: string | null
          created_at: string | null
          descripcion: string
          estado: string
          id: string
          medio_pago: string
          monto: number
          proveedor: string | null
          registrado_por: string | null
        }
        SetofOptions: {
          from: "*"
          to: "gastos_caja"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_pago: {
        Args: {
          p_cliente_id: string
          p_comprobante?: Json
          p_concepto: string
          p_fecha?: string
          p_medio: string
          p_monto: number
          p_permitir_excedente?: boolean
          p_referencia?: string
          p_reserva_id?: string
          p_tipo_pago: string
        }
        Returns: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caja_id: string | null
          cliente_id: string | null
          comprobante: string | null
          comprobante_id: string | null
          concepto: string | null
          created_at: string | null
          cuotas_tarjeta: number | null
          es_historico: boolean | null
          estado: string
          fecha: string | null
          fecha_hora: string
          id: string
          medio: string | null
          monto: number | null
          monto_pendiente_verificacion: boolean
          nro_cuota: number | null
          origen: string
          referencia: string | null
          registrado_por: string | null
          reserva_id: string | null
          tipo_pago: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pagos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserva_activa: {
        Args: { p_estado: string; p_inicio: string; p_preconfirmada: boolean }
        Returns: boolean
      }
      resumen_caja: { Args: { p_caja_id: string }; Returns: Json }
      rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      usuario_activo: { Args: never; Returns: boolean }
    }
    Enums: {
      rol_usuario: "superadmin" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      rol_usuario: ["superadmin", "admin"],
    },
  },
} as const
