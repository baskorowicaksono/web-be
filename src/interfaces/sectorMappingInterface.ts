// src/types/sector-mapping.ts - Align with frontend interface
export interface SectorMappingResponse {
  id: string
  action: string
  sectorName: string
  sectorGroups: string[]
  effectiveStartDate: string
  endDate?: string
  createdBy: string
  updatedBy?: string
  approvedBy?: string
  status: 'draft' | 'active' | 'pending_approval' | 'approved'
  createdAt: string
  updatedAt: string
}

export interface CreateSectorMappingRequest {
  sectorName: string
  groupId: number
  sektorEkonomi: string[]  // Array of sector codes to map
  tipeKelompok: 'NON_KLM' | 'SEKTOR_TERTENTU' | 'HIJAU'
  namaKelompok?: string
  prioritasSektor?: number
  effectiveStartDate: string
  endDate?: string
}

export interface ExcelUploadRequest {
  sectorName: string
  effectiveDate: string
  file: Buffer
  filename: string
}

export interface SectorMappingFilters {
  status?: 'all' | 'draft' | 'active' | 'pending_approval' | 'approved'
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'quarter'
  sectorCode?: string
  createdBy?: string
  page?: number
  limit?: number
}