// Registry ArtifactId -> ArtifactDefinition (doc sec13) - hien chi co
// Ngu Hanh Chau; Kiem Tu/The Tu chua co definition (khong tao placeholder).
import type { ArtifactDefinition, ArtifactId } from '../../core/artifact/Artifact'
import { NGU_HANH_CHAU_DEFINITION } from './NguHanhChau'

export const ARTIFACTS: Record<ArtifactId, ArtifactDefinition> = {
  ngu_hanh_chau: NGU_HANH_CHAU_DEFINITION,
}
