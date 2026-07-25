import { hostPermissionPattern } from "./contract";
import { PairedInstances } from "./instances";

export const PAIRED_INSTANCE_CONTENT_SCRIPT_ID = "ytze-paired-instances";

export function pairedInstanceContentScriptMatches(instances: PairedInstances) {
  return [...new Set(Object.values(instances).flatMap((instance) => {
    const pattern = hostPermissionPattern(instance.url);
    return pattern ? [pattern] : [];
  }))].sort();
}
