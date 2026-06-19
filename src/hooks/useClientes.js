import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useClientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchClientes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) throw error
      setClientes(data || [])
    } catch (err) {
      console.error('Error fetching clientes:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  const createCliente = async (cliente) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([cliente])
        .select()

      if (error) throw error
      setClientes((prev) => [...prev, data[0]].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      return data[0]
    } catch (err) {
      console.error('Error creating cliente:', err)
      throw err
    }
  }

  const updateCliente = async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) throw error
      setClientes((prev) =>
        prev.map((c) => (c.id === id ? data[0] : c)).sort((a, b) => a.nombre.localeCompare(b.nombre))
      )
      return data[0]
    } catch (err) {
      console.error('Error updating cliente:', err)
      throw err
    }
  }

  const deleteCliente = async (id) => {
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
      setClientes((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error('Error deleting cliente:', err)
      throw err
    }
  }

  return { clientes, loading, error, createCliente, updateCliente, deleteCliente, refetch: fetchClientes }
}