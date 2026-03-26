import React from 'react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';

const PLATFORM_NAME = 'SGI';
const CONTACT_EMAIL = 'info@inmogestion.com';

export function TermsAndConditionsPage() {
  const lastUpdatedDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <PublicLayout>
      <PublicSection background="white">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Términos y Condiciones de Uso
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            Última actualización: {lastUpdatedDate}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 md:p-12">
          <div className="prose prose-lg max-w-none text-gray-700 dark:text-gray-300">
            <p>
              Bienvenido a {PLATFORM_NAME}. Estos términos regulan el acceso y uso del sitio web de la plataforma, las
              aplicaciones asociadas y los servicios de software ofrecidos para la gestión de portales de alquiler
              (viviendas por temporadas y espacios para eventos) y sus propiedades.
            </p>
            <p>
              Al utilizar el servicio, declaras haber leído y aceptado estas condiciones. Si no estás de acuerdo, no
              utilices la plataforma ni crees una cuenta de usuario.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">1. Descripción del servicio</h2>
            <p>
              {PLATFORM_NAME} («la Plataforma») es una solución de tipo software como servicio (SaaS) que permite a
              empresas y profesionales cargar, organizar y publicar información sobre propiedades destinadas al alquiler
              temporal de viviendas y al alquiler de espacios para eventos. Las funcionalidades pueden incluir, entre
              otras, la gestión de fichas, disponibilidad, comunicación con interesados y herramientas operativas asociadas
              a los portales gestionados mediante la Plataforma.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">2. Anuncios y datos de propiedad</h2>
            <p>
              Eres responsable de la exactitud, legalidad y actualización de cada anuncio y de los datos asociados
              (descripciones, fotografías, vídeos, direcciones aproximadas o exactas, precios, tasas, disponibilidad,
              reglas de la casa o del venue, aforos y restricciones).
            </p>
            <p>
              Solo puedes publicar propiedades o espacios sobre los que tengas derecho a comercializar o alquilar, o
              para los que cuentes con la autorización expresa del titular. Las imágenes y textos deben corresponder al
              inmueble o espacio ofrecido y no inducir a error sobre sus características esenciales.
            </p>
            <p>
              Debes mantener coherencia entre lo anunciado en la Plataforma y las condiciones reales del alquiler
              (incluidas políticas de cancelación o depósitos cuando aplique). Cualquier omisión grave o información
              fraudulenta puede motivar la retirada del contenido o la suspensión de la cuenta.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">3. Uso de los portales</h2>
            <p>
              La Plataforma puede dar soporte a uno o más portales orientados a verticales distintas (por ejemplo,
              alquiler de casas temporales frente a alquiler de espacios para eventos). Te comprometes a clasificar y
              describir cada listado de forma adecuada al tipo de portal y de público al que va dirigido.
            </p>
            <p>
              No utilizarás las herramientas de publicación para mezclar ofertas incompatibles con el uso declarado del
              portal (por ejemplo, anunciar en el portal de eventos bienes claramente exclusivos de otro vertical sin
              adecuación ni autorización, cuando la Plataforma lo requiera), ni para eludir las normas internas de uso
              que se te comuniquen razonablemente.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">4. Cuentas de usuario y seguridad</h2>
            <p>
              El registro exige datos veraces. Mantienes la confidencialidad de tus credenciales y notificas de forma
              inmediata cualquier uso no autorizado de tu cuenta. Toda actividad realizada con tu usuario se presume
              imputable a ti o a tu organización, salvo que demuestres lo contrario de manera fehaciente.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">5. Contenido del usuario y licencia</h2>
            <p>
              Conservas los derechos sobre el contenido que cargues (fichas, imágenes, textos, etc.). Nos concedes una
              licencia no exclusiva, mundial y gratuita para alojar, reproducir, mostrar y distribuir dicho contenido en la
              medida necesaria para prestar el servicio (incluida su publicación en los portales y canales habilitados).
            </p>
            <p>Garantizas que tu contenido:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>No infringe derechos de terceros ni obligaciones contractuales que te afecten.</li>
              <li>No es ilícito, difamatorio, engañoso ni contrario a la buena fe comercial.</li>
              <li>Cumple la normativa aplicable en materia de publicidad, vivienda turística, eventos y protección de datos.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">6. Responsabilidades del usuario</h2>
            <p>Te obligas a:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Utilizar la Plataforma conforme a la ley y a estos términos.</li>
              <li>No introducir malware ni intentar acceder de forma no autorizada a sistemas o datos de otros usuarios.</li>
              <li>No enviar spam ni usar la mensajería o los formularios para fines ajenos a la gestión legítima de reservas y consultas.</li>
              <li>Respectar la normativa local aplicable a alquileres temporales, eventos, seguridad, licencias y tributos que correspondan a tu actividad.</li>
            </ul>
            <p>
              Eres el único responsable frente a terceros (huéspedes, organizadores, administraciones u otros) por los
              contratos y obligaciones que derives de tus anuncios. La Plataforma no actúa como arrendador ni como
              intermediario obligatorio en cada operación concreta, salvo que se indique expresamente otra cosa en un
              acuerdo comercial específico.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">7. Uso aceptable y contenido prohibido</h2>
            <p>Queda prohibido, entre otros usos:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Publicar bienes o servicios ilícitos, o anuncios con fines fraudulentos.</li>
              <li>Suplantar identidades o manipular reseñas o métricas de forma deshonesta.</li>
              <li>Extracción masiva automatizada de datos de la Plataforma sin autorización (scraping no permitido).</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">8. Propiedad intelectual</h2>
            <p>
              El software, el diseño de la interfaz, la documentación y el resto de componentes propios de {PLATFORM_NAME}{' '}
              (excluido tu contenido) están protegidos por la legislación aplicable en materia de propiedad intelectual e
              industrial.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">9. Terminación</h2>
            <p>
              Podemos suspender o cancelar el acceso a la cuenta si incumples estos términos o por requerimientos legales.
              Puedes dejar de usar el servicio en cualquier momento; las obligaciones que por su naturaleza deban
              sobrevivir (limitaciones de responsabilidad, indemnidad cuando proceda, propiedad intelectual) permanecerán
              vigentes en la medida permitida por la ley.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">10. Limitación de responsabilidad</h2>
            <p>
              El servicio se presta «tal cual» y «según disponibilidad». Salvo que la legislación imperativa exija otra
              cosa, {PLATFORM_NAME} no será responsable por daños indirectos, lucro cesante o pérdida de datos derivados
              del uso o la imposibilidad de uso de la Plataforma. No garantizamos resultados comerciales concretos ni la
              continuidad ininterrumpida del servicio.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">11. Cambios en los términos</h2>
            <p>
              Podemos actualizar estos términos. Los cambios relevantes se comunicarán por medios razonables (por
              ejemplo, aviso en la Plataforma o por correo electrónico). El uso continuado tras la entrada en vigor de
              las modificaciones implica la aceptación actualizada, salvo que la ley exija un procedimiento distinto.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">12. Ley aplicable y jurisdicción</h2>
            <p>
              Estos términos se rigen por la legislación española, sin perjuicio de normas imperativas que, en su caso,
              resulten aplicables a consumidores residentes en otros países. Para cualquier controversia, las partes se
              someten a los juzgados y tribunales de España, salvo que la ley establezca otra competencia indisponible
              para el usuario.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">13. Contacto</h2>
            <p>
              Para consultas sobre estos términos, escríbenos a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline">
                {CONTACT_EMAIL}
              </a>{' '}
              o utiliza el formulario de contacto en el sitio web.
            </p>
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}
