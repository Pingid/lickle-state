import { defineConfig, Layout } from '@lickle/docs/config'

export default defineConfig({
  name: '@lickle/state',
  layout: Layout.grouping(
    Layout.composeGroups(
      Layout.groupByKind,
      Layout.groupByTag(
        '@group',
        (x) => x,
        // (y) => y + 20,
      ),
    ),
  ),
})
