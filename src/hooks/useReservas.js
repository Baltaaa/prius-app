import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useReservas() {
  const [reservas, setReservas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch unidades
      const { data: unitsData, error: unitsError } = await supabase
        .from('unidades')
        .select('*')
        .order('numero', { ascending: true })
      
      if (unitsError) throw unitsError
      setUnidades(unitsData || [])

      // Fetch reservas con relaciones
      const { data: resData, error: resError } = await supabase
        .from('reservas')
        .select(`
          *,
          clientes (id, nombre, telefono, cuit, mail),
          unidades (id, numero, tipo, zona)
        `)
        .order('created_at', { ascending: false })

      if (resError) throw resError
      setReservas(resData || [])
    } catch (err) {
      console.error('Error fetching data in useReservas:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const createReserva = async (reserva) => {
    try {
      const { data, error } = await supabase
        .from('reservas')
        .insert([reserva])
        .select(`
          *,
          clientes (id, nombre, telefono, cuit, mail),
          unidades (id, numero, tipo, zona)
        `)

      if (error) throw error

      // Actualizar estado de unidad a reservada/ocupada
      await supabase
        .from('unidades')
        .update({ estado: 'reservada' })
        .eq('id', reserva.unidad_id)

      setReservas((prev) => [data[0], ...prev])
      setUnidades((prev) =>
        prev.map((u) => (u.id === reserva.unidad_id ? { ...u, estado: 'reservada' } : u))
      )
      return data[0]
    } catch (err) {
      console.error('Error creating reserva:', err)
      throw err
    }
  }

  const updateReserva = async (id, updates) => {
    try {
      // Extraemos clientes y unidades si vienen en las actualizaciones
      const { clientes, unidades, ...cleanUpdates } = updates

      const { data, error } = await supabase
        .from('reservas')
        .update(cleanUpdates)
        .eq('id', id)
        .select(`
          *,
          clientes (id, nombre, telefono, cuit, mail),
          unidades (id, numero, tipo, zona)
        `)

      if (error) throw error
      setReservas((prev) => prev.map((r) => (r.id === id ? data[0] : r)))
      return data[0]
    } catch (err) {
      console.error('Error updating reserva:', err)
      throw err
    }
  }

  const deleteReserva = async (id, unidadId) => {
    try {
      const { error } = await supabase.from('reservas').delete().eq('id', id)
      if (error) throw error

      if (unidadId) {
        await supabase
          .from('unidades')
          .update({ estado: 'libre' })
          .eq('id', unidadId)
        
        setUnidades((prev) =>
          prev.map((u) => (u.id === unidadId ? { ...u, estado: 'libre' } : u))
        )
      }

      setReservas((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error('Error deleting reserva:', err)
      throw err
    }
  }

  return { reservas, unidades, loading, error, createReserva, updateReserva, deleteReserva, refetch: fetchData }
}