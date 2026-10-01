import React from 'react';

// Mapa completo de longitudes específicas (Se mantiene intacto para la lógica)
export const LONGITUDES_TELEFONO = {
  '+34':  { min: 9, max: 9 },    // España
  '+49':  { min: 10, max: 11 },  // Alemania
  '+376': { min: 6, max: 6 },    // Andorra
  '+54':  { min: 10, max: 11 },  // Argentina
  '+43':  { min: 11, max: 11 },  // Austria
  '+32':  { min: 9, max: 9 },    // Bélgica
  '+591': { min: 8, max: 8 },    // Bolivia
  '+387': { min: 8, max: 9 },    // Bosnia y Herzegovina
  '+375': { min: 9, max: 9 },    // Bielorrusia
  '+3Bul':{ min: 9, max: 9 },    // Bulgaria
  '+56':  { min: 9, max: 9 },    // Chile
  '+357': { min: 8, max: 8 },    // Chipre
  '+57':  { min: 10, max: 10 },  // Colombia
  '+506': { min: 8, max: 8 },    // Costa Rica
  '+385': { min: 8, max: 9 },    // Croacia
  '+53':  { min: 8, max: 8 },    // Cuba
  '+45':  { min: 8, max: 8 },    // Dinamarca
  '+593': { min: 9, max: 9 },    // Ecuador
  '+503': { min: 8, max: 8 },    // El Salvador
  '+386': { min: 8, max: 8 },    // Eslovenia
  '+421': { min: 9, max: 9 },    // Eslovaquia
  '+1':   { min: 10, max: 10 },  // Estados Unidos
  '+372': { min: 7, max: 8 },    // Estonia
  '+358': { min: 5, max: 10 },  // Finlandia
  '+33':  { min: 9, max: 9 },    // Francia
  '+30':  { min: 10, max: 10 },  // Grecia
  '+502': { min: 8, max: 8 },    // Guatemala
  '+240': { min: 9, max: 9 },    // Guinea Ecuatorial
  '+504': { min: 8, max: 8 },    // Honduras
  '+36':  { min: 9, max: 9 },    // Hungría
  '+353': { min: 7, max: 9 },    // Irlanda
  '+354': { min: 7, max: 9 },    // Islandia
  '+39':  { min: 10, max: 10 },  // Italia
  '+371': { min: 8, max: 8 },    // Letonia
  '+370': { min: 8, max: 8 },    // Lituania
  '+352': { min: 4, max: 11 },  // Luxemburgo
  '+389': { min: 8, max: 8 },    // Macedonia del Norte
  '+356': { min: 8, max: 8 },    // Malta
  '+52':  { min: 10, max: 10 },  // México
  '+377': { min: 8, max: 9 },    // Mónaco
  '+373': { min: 8, max: 8 },    // Moldavia
  '+382': { min: 8, max: 8 },    // Montenegro
  '+505': { min: 8, max: 8 },    // Nicaragua
  '+47':  { min: 8, max: 8 },    // Noruega
  '+31':  { min: 9, max: 9 },    // Países Bajos
  '+507': { min: 8, max: 8 },    // Panamá
  '+595': { min: 9, max: 9 },    // Paraguay
  '+51':  { min: 9, max: 9 },    // Perú
  '+48':  { min: 9, max: 9 },    // Polonia
  '+351': { min: 9, max: 9 },    // Portugal
  '+1-787': { min: 10, max: 10 },// Puerto Rico
  '+44':  { min: 10, max: 10 },  // Reino Unido
  '+420': { min: 9, max: 9 },    // República Checa
  '+1-809': { min: 10, max: 10 },// República Dominicana
  '+40':  { min: 9, max: 9 },    // Rumanía
  '+378': { min: 6, max: 10 },  // San Marino
  '+381': { min: 8, max: 12 },  // Serbia
  '+46':  { min: 7, max: 9 },    // Suecia
  '+41':  { min: 9, max: 9 },    // Suiza
  '+380': { min: 9, max: 9 },    // Ucrania
  '+598': { min: 8, max: 8 },    // Uruguay
  '+379': { min: 10, max: 10 },  // Vaticano
  '+58':  { min: 10, max: 10 },  // Venezuela
};

export default function PhoneInput({ form, errores, handleFormChange }) {
  return (
    <div className="input-group">
      {/* Selector Desplegable Alfabetizado */}
      <select
        name="prefijo"
        value={form.prefijo || '+34'}
        onChange={handleFormChange}
        className="form-select"
        style={{ maxWidth: '115px' }}
      >
          <option value="+34">ES (+34)</option>
          <option value="+49">DE (+49)</option>    {/* Alemania */}
          <option value="+376">AD (+376)</option>   {/* Andorra */}
          <option value="+54">AR (+54)</option>    {/* Argentina */}
          <option value="+43">AT (+43)</option>    {/* Austria */}
          <option value="+32">BE (+32)</option>    {/* Bélgica */}
          <option value="+591">BO (+591)</option>   {/* Bolivia */}
          <option value="+375">BY (+375)</option>   {/* Bielorrusia */}
          <option value="+387">BA (+387)</option>   {/* Bosnia */}
          <option value="+56">CL (+56)</option>    {/* Chile */}
          <option value="+357">CY (+357)</option>   {/* Chipre */}
          <option value="+57">CO (+57)</option>    {/* Colombia */}
          <option value="+506">CR (+506)</option>  {/* Costa Rica */}
          <option value="+385">HR (+385)</option>   {/* Croacia */}
          <option value="+53">CU (+53)</option>    {/* Cuba */}
          <option value="+45">DK (+45)</option>    {/* Dinamarca */}
          <option value="+593">EC (+593)</option>   {/* Ecuador */}
          <option value="+503">SV (+503)</option>   {/* El Salvador */}
          <option value="+421">SK (+421)</option>   {/* Eslovaquia */}
          <option value="+386">SI (+386)</option>   {/* Eslovenia */}
          <option value="+1">US (+1)</option>      {/* Estados Unidos */}
          <option value="+372">EE (+372)</option>   {/* Estonia */}
          <option value="+358">FI (+358)</option>   {/* Finlandia */}
          <option value="+33">FR (+33)</option>    {/* Francia */}
          <option value="+30">GR (+30)</option>    {/* Grecia */}
          <option value="+502">GT (+502)</option>   {/* Guatemala */}
          <option value="+240">GQ (+240)</option>  {/* Guinea Ecuat. */}
          <option value="+504">HN (+504)</option>   {/* Honduras */}
          <option value="+36">HU (+36)</option>    {/* Hungría */}
          <option value="+353">IE (+353)</option>   {/* Irlanda */}
          <option value="+354">IS (+354)</option>   {/* Islandia */}
          <option value="+39">IT (+39)</option>    {/* Italia */}
          <option value="+371">LV (+371)</option>   {/* Letonia */}
          <option value="+370">LT (+370)</option>   {/* Lituania */}
          <option value="+352">LU (+352)</option>   {/* Luxemburgo */}
          <option value="+389">MK (+389)</option>   {/* Macedonia */}
          <option value="+356">MT (+356)</option>   {/* Malta */}
          <option value="+52">MX (+52)</option>    {/* México */}
          <option value="+373">MD (+373)</option>   {/* Moldavia */}
          <option value="+377">MC (+377)</option>   {/* Mónaco */}
          <option value="+382">ME (+382)</option>   {/* Montenegro */}
          <option value="+505">NI (+505)</option>   {/* Nicaragua */}
          <option value="+47">NO (+47)</option>    {/* Noruega */}
          <option value="+31">NL (+31)</option>    {/* Países Bajos */}
          <option value="+507">PA (+507)</option>   {/* Panamá */}
          <option value="+595">PY (+595)</option>   {/* Paraguay */}
          <option value="+51">PE (+51)</option>    {/* Perú */}
          <option value="+48">PL (+48)</option>    {/* Polonia */}
          <option value="+351">PT (+351)</option>   {/* Portugal */}
          <option value="+1-787">PR (+1)</option>   {/* Puerto Rico */}
          <option value="+44">GB (+44)</option>    {/* Reino Unido */}
          <option value="+420">CZ (+420)</option>   {/* Rep. Checa */}
          <option value="+1-809">DO (+1)</option>   {/* R. Dominicana */}
          <option value="+40">RO (+40)</option>    {/* Rumanía */}
          <option value="+378">SM (+378)</option>   {/* San Marino */}
          <option value="+381">RS (+381)</option>   {/* Serbia */}
          <option value="+46">SE (+46)</option>    {/* Suecia */}
          <option value="+41">CH (+41)</option>    {/* Suiza */}
          <option value="+380">UA (+380)</option>   {/* Ucrania */}
          <option value="+598">UY (+598)</option>   {/* Uruguay */}
          <option value="+379">VA (+379)</option>   {/* Vaticano */}
          <option value="+58">VE (+58)</option>    {/* Venezuela */}
      </select>

      {/* Input Numérico */}
      <input
        name="telefono"
        type="tel"
        value={form.telefono || ''}
        className={`form-control ${errores?.telefono ? 'is-invalid' : ''}`}
        placeholder="600 000 000"
        onChange={(e) => {
          const soloNumeros = e.target.value.replace(/[^0-9]/g, '');
          const prefijoActual = form.prefijo || '+34';
          const reglaPais = LONGITUDES_TELEFONO[prefijoActual] || { max: 13 };

          if (soloNumeros.length <= reglaPais.max) {
            handleFormChange({
              target: {
                name: 'telefono',
                value: soloNumeros
              }
            });
          }
        }}
      />
      {errores?.telefono && (
        <div className="invalid-feedback d-block">
          {errores.telefono}
        </div>
      )}
    </div>
  );
}
