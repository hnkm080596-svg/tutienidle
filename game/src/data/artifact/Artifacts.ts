// Registry ArtifactId -> ArtifactDefinition (doc §13) — hiện chỉ có
// Ngũ Hành Châu; Kiếm Tu/Thể Tu chưa có definition (không tạo placeholder).
import type { ArtifactDefinition, ArtifactId } from '../../core/artifact/Artifact'
import { NGU_HANH_CHAU_DEFINITION } from './NguHanhChau'

export const ARTIFACTS: Record<ArtifactId, ArtifactDefinition> = {
  ngu_hanh_chau: NGU_HANH_CHAU_DEFINITION,
}
