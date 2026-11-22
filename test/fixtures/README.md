# Test fixtures

Real MeteoGalicia answers, read from `servizos.meteogalicia.gal/mgrss` on 22 November 2026 around
10:50 UTC, used by the tests instead of the network. They hold no personal data (public weather
data).

| File                        | Source                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `stations.json`             | `observacion/listaEstacionsMeteo.action`, unchanged (155 stations)                               |
| `concellos.json`            | `observacion/observacionConcellos.action`, unchanged (313 municipalities)                        |
| `observation-10053.json`    | `observacion/ultimos10minEstacionsMeteo.action?idEst=10053` (Campus Lugo: every measure)         |
| `observation-10142.json`    | same, Vigo: no wind nor pressure                                                                 |
| `observation-10157.json`    | same, Coruña-Torre de Hércules: no wind nor pressure                                             |
| `forecast-<INE code>.json`  | `predicion/jsonPredConcellos.action?idConc=` for A Coruña (15030), Lugo (27028) and Vigo (36057) |
| `warning-levels-27028.json` | `predicion/adversos/jsonConcellosNivelMax.action?idConcello=27028&dia=-1` (Lugo, no warning)     |
| `gladys-feature-table.json` | Category/type couples, units and poll frequencies the Gladys core knows (from the core code)     |

No warning was in force in Galicia that day: the tests build the raised levels with
`warningLevels()` (`test/helpers/fakeMeteoGalicia.js`), in the same format. The tests re-date the
station reading to the test clock.
