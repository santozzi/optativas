import assert from 'assert';
import { repairExtraction } from '../src/services/extractionRepair';
import { materiasGenericas, procesarPedidoOptativas } from '../src/services/texto';

const microsoftPrintText = `
Pedidos de Optativas Vigentes
Materia

Código Fecha Pedido Plan

PARASITOSIS EMERGENTES, RE-EMERGENTES Y ARTROPODOLOGIA MEDICA

20073

29/08/2023

2023

PRESCRIPCION DEL EJERCICIO Y LA ACTIVIDAD FISICA

20068

29/08/2023

2023

COMPLETAR los campos con TODAS las materias elegidas
`;

const splitHeaderText = `
Pedidos de Optativas Vigentes
Materia

Código Fecha

Plan

Pedido
CONSUMOS PROBLEMATICOS Y ADICCIONES: PERSPECTIVA DE DERECHOS Y

20133

29/08/2023 2023

20071

29/08/2023 2023

REDUCCION DEL DAÑO
SALUD AMBIENTAL

COMPLETAR los campos con TODAS las materias elegidas
Año: 3
Periodo Lectivo: Semanal
Mat. Genérica: G0950 - Optativa de Medicina, plan 2023
CONSUMOS PROBLEMATICOS Y ADICCIONES: PERSPECTIVA DE DERECHOS Y REDUCCION DEL DAÑO (20133)
Mat. Genérica: G0951 - Optativa de Medicina, plan 2023
SALUD AMBIENTAL (20071)
`;

const ocrGenericsText = `
COMPLETAR los campos con TODAS las materias elegidas
Periodo Lectivo: Semanal
Mat. Genérica: 60950 - Optativa de Medicina, plan 2023 Puntos Requeridos: m
METODOLOGIA DE LA INVESTIGACION CLINICA (20040) v
Mat. Genérica: 60951 - Optativa de Medicina, plan 2023 Puntos Requeridos: m
NEUROCIENCIA DEL SUEÑO (20136) v
Periodo Lectivo: Semanal
Mat. Genérica: GM002 - Módulo Electivo, Medicina, Plan 2023 Puntos Requeridos: m
MODULO ELECTIVO (20070) “
`;

const microsoftRows = procesarPedidoOptativas(microsoftPrintText);
assert.deepStrictEqual(microsoftRows, [
  {
    materia: 'PARASITOSIS EMERGENTES, RE-EMERGENTES Y ARTROPODOLOGIA MEDICA',
    codigo: '20073',
    fechaPedido: '29/08/2023',
    plan: '2023',
  },
  {
    materia: 'PRESCRIPCION DEL EJERCICIO Y LA ACTIVIDAD FISICA',
    codigo: '20068',
    fechaPedido: '29/08/2023',
    plan: '2023',
  },
]);

const splitHeaderRows = procesarPedidoOptativas(splitHeaderText);
const splitHeaderGenerics = materiasGenericas(splitHeaderText);
repairExtraction({
  plan: '2023 / 1',
  materias: splitHeaderRows,
  anuales: splitHeaderGenerics,
  rawText: splitHeaderText,
});
assert.deepStrictEqual(splitHeaderRows.map(row => `${row.codigo} - ${row.materia}`), [
  '20133 - CONSUMOS PROBLEMATICOS Y ADICCIONES: PERSPECTIVA DE DERECHOS Y REDUCCION DEL DAÑO',
  '20071 - SALUD AMBIENTAL',
]);

const ocrGenerics = materiasGenericas(ocrGenericsText);
assert.strictEqual(ocrGenerics.length, 2);
assert.strictEqual(ocrGenerics[0].año, 3);
assert.strictEqual(ocrGenerics[0].generica[0].código, 'G0950');
assert.strictEqual(ocrGenerics[0].generica[1].código, 'G0951');
assert.strictEqual(ocrGenerics[1].año, 6);
assert.strictEqual(ocrGenerics[1].generica[0].materia?.código, '20070');

console.log('Parsing smoke tests passed');
