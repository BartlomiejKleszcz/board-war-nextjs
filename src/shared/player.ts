import { UnitDto } from "./unit"

export interface Player {
    id: number
    name: string
    color: string
    units: [UnitDto]
    budget: number
}