import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCaja() {
  const [cajaHoy, setCajaHoy] = useState(null)
  const [historialCajas, setHistorialCajas] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCajaHoy = async () => {
    try {
      setLoading(true)
      const todayStr = new Date().toISOString().split('T')[0]

      // Buscar caja de hoy
      const { data: cajaData, error: cajaError } = await supabase
        .from('caja_diaria')
        .select('*')
        .eq('fecha', todayStr)
        .maybeSingle()

      if (cajaError) throw cajaError

      if (cajaData) {
        setCajaHoy(cajaData)
        // Traer gastos correspondientes
        const { data: gastosData, error: gastosError } = await supabase
          .from('gastos_caja')
          .select('*')
          .eq('caja_id', cajaData.id)
        
        if (gastosError) throw gastosError
        setGastos(gastosData || [])
      } else {
        setCajaHoy(null)
        setGastos([])
      }

      // Traer últimas 30 cajas
      const { data: history, error: historyError } = await supabase
        .from('caja_diaria')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(30)

      if (historyError) throw historyError
      setHistorialCajas(history || [])
    } catch (err) {
      console.error('Error fetching caja:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCajaHoy()
  }, [])

  const iniciarCaja = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const newCaja = {
        fecha: todayStr,
        efectivo: 0,
        medio_pago_1: 0,
        medio_pago_2: 0,
        total_cobros: 0,
        total_gastos: 0,
        total_neto: 0,
        cerrada: false
      }

      const { data, error } = await supabase
        .from('caja_diaria')
        .insert([newCaja])
        .select()

      if (error) throw error
      setCajaHoy(data[0])
      setHistorialCajas(prev => [data[0], ...prev])
      return data[0]
    } catch (err) {
      console.error('Error starting caja:', err)
      throw err
    }
  }

  const actualizarCajaValores = async (updates) => {
    if (!cajaHoy) return
    try {
      const total_cobros = Number(updates.efectivo || 0) + Number(updates.medio_pago_1 || 0) + Number(updates.medio_pago_2 || 0)
      const total_neto = total_cobros - Number(cajaHoy.total_gastos || 0)

      const finalUpdates = {
        ...updates,
        total_cobros,
        total_neto
      }

      const { data, error } = await supabase
        .from('caja_diaria')
        .update(finalUpdates)
        .eq('id', cajaHoy.id)
        .select()

      if (error) throw error
      setCajaHoy(data[0])
      setHistorialCajas(prev => prev.map(c => c.id === cajaHoy.id ? data[0] : c))
      return data[0]
    } catch (err) {
      console.error('Error updating values in caja:', err)
      throw err
    }
  }

  const agregarGasto = async (descripcion, monto) => {
    if (!cajaHoy) return
    try {
      const nuevoGasto = {
        caja_id: cajaHoy.id,
        descripcion,
        monto: Number(monto)
      }

      const { data, error: gastoError } = await supabase
        .from('gastos_caja')
        .insert([nuevoGasto])
        .select()

      if (gastoError) throw gastoError

      // Actualizar totales de caja diaria
      const nuevoTotalGastos = Number(cajaHoy.total_gastos) + Number(monto)
      const nuevoNeto = Number(cajaHoy.total_cobros) - nuevoTotalGastos

      const { data: updatedCaja, error: cajaError } = await supabase
        .from('caja_diaria')
        .update({
          total_gastos: nuevoTotalGastos,
          total_neto: nuevoNeto
        })
        .eq('id', cajaHoy.id)
        .select()

      if (cajaError) throw cajaError

      setGastos(prev => [...prev, data[0]])
      setCajaHoy(updatedCaja[0])
      setHistorialCajas(prev => prev.map(c => c.id === cajaHoy.id ? updatedCaja[0] : c))
    } catch (err) {
      console.error('Error adding gasto:', err)
      throw err
    }
  }

  const eliminarGasto = async (gastoId, monto) => {
    if (!cajaHoy) return
    try {
      const { error: deleteError } = await supabase
        .from('gastos_caja')
        .delete()
        .eq('id', gastoId)

      if (deleteError) throw deleteError

      const nuevoTotalGastos = Math.max(0, Number(cajaHoy.total_gastos) - Number(monto))
      const nuevoNeto = Number(cajaHoy.total_cobros) - nuevoTotalGastos

      const { data: updatedCaja, error: cajaError } = await supabase
        .from('caja_diaria')
        .update({
          total_gastos: nuevoTotalGastos,
          total_neto: nuevoNeto
        })
        .eq('id', cajaHoy.id)
        .select()

      if (cajaError) throw cajaError

      setGastos(prev => prev.filter(g => g.id !== gastoId))
      setCajaHoy(updatedCaja[0])
      setHistorialCajas(prev => prev.map(c => c.id === cajaHoy.id ? updatedCaja[0] : c))
    } catch (err) {
      console.error('Error deleting gasto:', err)
      throw err
    }
  }

  const cerrarCaja = async () => {
    if (!cajaHoy) return
    try {
      const { data, error } = await supabase
        .from('caja_diaria')
        .update({ cerrada: true })
        .eq('id', cajaHoy.id)
        .select()

      if (error) throw error
      setCajaHoy(data[0])
      setHistorialCajas(prev => prev.map(c => c.id === cajaHoy.id ? data[0] : c))
      return data[0]
    } catch (err) {
      console.error('Error closing caja:', err)
      throw err
    }
  }

  return { cajaHoy, historialCajas, gastos, loading, error, iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja, refetch: fetchCajaHoy }
}