import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@x1a0f3n9/dsh-client-ui-theme',
  ['lib/types/index.js'],
  {
    lib: {
      copy: [{
        from: 'src/styles/{brand-font.css,montserrat-*.woff2,Montserrat-OFL.txt}',
        to: 'lib/styles',
      }],
    },
  },
)
