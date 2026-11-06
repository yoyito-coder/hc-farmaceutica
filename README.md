# HC Farmacéutica

Formato interactivo de **historia clínica farmacéutica** para químicos farmacéuticos en formación y formados. Sigue el Proceso de Atención al Paciente (Recolectar → Evaluar → Planificar → Implementar → Seguir) y la estructura del taller de inducción a la rotación clínica.

**Usar en línea:** https://jadiazr09.github.io/hc-farmaceutica/ (GitHub Pages)

## Qué incluye

| Sección | Contenido |
|---|---|
| 1. Datos del paciente | Identificación, antecedentes, alergias, hábitos, determinantes sociales, signos vitales. Cálculo automático de IMC, superficie corporal, peso ideal/ajustado y CrCl (Cockcroft-Gault). |
| 2. Diagnósticos | Síntesis y priorización (agudos, crónicos clave, estables) y tabla Dx paciente (curso, severidad, control). |
| 3. Paraclínicos | Valor y rango de referencia con marcado automático de valores alterados. |
| 4. Conciliación | Lista domiciliaria frente a prescripción actual, fuente, indicación, decisión (continuar, ajustar, sustituir, suspender), tipo de discrepancia y justificación. |
| 5. Evaluación sistemática | Las 12 preguntas del taller para cada medicamento activo (Sí / No / FI). |
| 6. PRM e intervenciones | Alertas automáticas y registro de PRM: categoría › tipo › causa (Indicación, Efectividad, Seguridad, Adherencia), RNM del Tercer Consenso de Granada, severidad, prioridad, intervención, aceptación y monitoreo. |
| 7. PAF | Plan de atención por problema de salud. |
| 8. Monitoreo | Parámetros, metas y registros en el tiempo. |
| 9. Plan de egreso | Horarios, para qué sirve, efectos adversos, cuándo consultar y recomendaciones. |
| 10. Nota SOAP | Borrador automático a partir de los datos, editable. |
| 11. Informe y exportación | Resumen, revisión del tutor y exportación. |

### Alertas automáticas (orientativas)

- Conciliación: omisiones, medicamentos sin decisión, discrepancias no justificadas.
- Indicación: medicamentos sin indicación y diagnósticos sin tratamiento asociado.
- Duplicidades terapéuticas.
- Interacciones de relevancia clínica (sangrado, hiperpotasemia, QT, serotoninérgico, CYP3A4, absorción, etc.).
- Ajuste por función renal según CrCl.
- Medicamentos potencialmente inapropiados en ≥ 65 años (criterios de Beers).
- Alergias y reactividad cruzada con betalactámicos.
- Medicamentos de alto riesgo (ISMP) y polifarmacia.

Cada alerta con PRM sugerido tiene el botón **Registrar PRM**, que precarga la clasificación.

> Las alertas usan listas de referencia simplificadas y **no sustituyen** el juicio clínico ni la consulta de Micromedex, Lexicomp, UpToDate o guías de práctica clínica.

### Exportar análisis

- **Word (.doc)**: informe completo en horizontal, editable.
- **PDF / Imprimir**: mismo informe; elija “Guardar como PDF”.
- **PRM en Excel (.csv)**: tabla de PRM e intervenciones.
- **Respaldo del caso (.json)**: guarda el caso para reabrirlo con **Abrir**.

### Modos

- **En formación**: muestra guías en cada paso y la sección de revisión del tutor.
- **Formado**: oculta las guías para un registro más rápido.

## Privacidad

No hay servidor: los datos se guardan solo en el navegador (`localStorage`). En equipos compartidos use iniciales y exporte el respaldo `.json` al terminar. Tenga en cuenta la Ley 1581 de 2012 de protección de datos personales.

## Uso local

Abra `index.html` en el navegador. No requiere instalación ni dependencias.

## Caso de ejemplo

El botón **Ejemplo** carga un caso **ficticio** (NAC en paciente con IC, FA anticoagulada y LRA) para practicar.
