import { Platform } from "react-native";

/**
 * Spread onto the <Text> a kit component renders from a prop, so tap-to-edit
 * knows which prop supplied the copy:
 *
 *   <Text {...tapField("label")} style={styles.label}>{label}</Text>
 *
 * On web (react-native-web) this becomes a `data-tap-field` DOM attribute the
 * runtime reads; on native it is a no-op (native resolution lands in Phase 2).
 */
export function tapField(name: string): Record<string, unknown> {
  return Platform.OS === "web" ? { dataSet: { tapField: name } } : {};
}
