import React from 'react';
// Make sure the path to your PublicLayout component is correct
import { PublicLayout } from '../../components/public/layout/PublicLayout'; 

export function TermsAndConditionsPage() {
  const lastUpdatedDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <PublicLayout>
      <div className="bg-[#FDFFFC] py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1B4965]">
              Términos y Condiciones de Uso
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Última actualización: {lastUpdatedDate}
            </p>
          </div>

          {/* Page Content */}
          <div className="prose prose-lg max-w-none text-[#101828]">
            <p>
              Bienvenido a InmoGestión. Estos términos y condiciones describen las reglas y regulaciones para el uso del sitio web y los servicios de InmoGestión, ubicados en [TuDominio.com].
            </p>
            <p>
              Al acceder a este sitio web, asumimos que aceptas estos términos y condiciones. No continúes usando InmoGestión si no estás de acuerdo con todos los términos y condiciones establecidos en esta página.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">1. Descripción del Servicio</h2>
            <p>
              InmoGestión ("la Plataforma", "el Servicio") es una aplicación de software como servicio (SaaS) que permite a los usuarios (principalmente agencias inmobiliarias y agentes) cargar, gestionar y publicar información sobre propiedades inmobiliarias. El Servicio incluye la capacidad de crear un sitio web público personalizado y listar propiedades en nuestro portal de búsqueda centralizado.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">2. Cuentas de Usuario</h2>
            <p>
              Para acceder a las funciones de gestión, debes registrarte y crear una cuenta. Eres responsable de mantener la confidencialidad de tu contraseña y cuenta. Aceptas notificarnos inmediatamente sobre cualquier uso no autorizado de tu cuenta. Eres el único responsable de toda la actividad que ocurra bajo tu cuenta. Debes proporcionar información precisa, actual y completa durante el proceso de registro.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">3. Contenido del Usuario</h2>
            <p>
              Tú retienes todos los derechos de propiedad sobre el contenido que cargas en la Plataforma, incluyendo datos de propiedades, descripciones, fotografías, videos y otros materiales ("Contenido del Usuario").
            </p>
            <p>
              Sin embargo, al cargar Contenido del Usuario, nos otorgas una licencia mundial, no exclusiva, libre de regalías y transferible para usar, reproducir, distribuir, mostrar y ejecutar dicho contenido en conexión con la prestación de los Servicios. Esto incluye, entre otros, la publicación de tus propiedades en tu sitio web personalizado y en nuestro portal de búsqueda público.
            </p>
            <p>
              Tú eres el único responsable de tu Contenido del Usuario y de las consecuencias de publicarlo. Garantizas que:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Eres el propietario del contenido o tienes las licencias, derechos y permisos necesarios para usarlo y autorizarnos a usarlo.</li>
              <li>La información proporcionada es precisa, veraz y no engañosa.</li>
              <li>El contenido no infringe los derechos de autor, marcas registradas, privacidad u otros derechos de terceros.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">4. Uso Aceptable</h2>
            <p>
              Aceptas no utilizar el Servicio para ningún propósito ilegal o no autorizado. Te comprometes a no:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Cargar contenido fraudulento, falso, ilegal o que infrinja la ley.</li>
              <li>Intentar obtener acceso no autorizado a nuestros sistemas informáticos o realizar cualquier actividad que interrumpa, disminuya la calidad o interfiera con el rendimiento del Servicio.</li>
              <li>Utilizar el Servicio para enviar spam o mensajes no solicitados.</li>
              <li>Hacerte pasar por otra persona o entidad.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">5. Propiedad Intelectual</h2>
            <p>
              El Servicio y su contenido original (excluyendo el Contenido del Usuario), características y funcionalidades son y seguirán siendo propiedad exclusiva de InmoGestión y sus licenciantes. El Servicio está protegido por derechos de autor, marcas registradas y otras leyes de [Tu País] y países extranjeros.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">6. Terminación</h2>
            <p>
              Podemos terminar o suspender tu cuenta de inmediato, sin previo aviso ni responsabilidad, por cualquier motivo, incluido, entre otros, el incumplimiento de estos Términos. Tras la terminación, tu derecho a utilizar el Servicio cesará de inmediato. Si deseas cancelar tu cuenta, puedes simplemente dejar de usar el Servicio o contactarnos.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">7. Limitación de Responsabilidad</h2>
            <p>
              El Servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD". InmoGestión no garantiza que el servicio sea ininterrumpido, seguro o libre de errores. En ningún caso InmoGestión, ni sus directores, empleados o socios, serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluida la pérdida de beneficios, datos o buena voluntad, que resulten de tu acceso o uso del Servicio.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">8. Cambios en los Términos</h2>
            <p>
              Nos reservamos el derecho, a nuestra entera discreción, de modificar o reemplazar estos Términos en cualquier momento. Si una revisión es material, intentaremos proporcionar un aviso de al menos 30 días antes de que los nuevos términos entren en vigor. Lo que constituye un cambio material se determinará a nuestra entera discreción.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">9. Ley Aplicable</h2>
            <p>
              Estos Términos se regirán e interpretarán de acuerdo con las leyes de [Tu Provincia/Estado, Tu País], sin tener en cuenta sus disposiciones sobre conflictos de leyes.
            </p>

            <h2 className="text-2xl font-semibold text-[#1B4965] mt-10 mb-4">10. Contacto</h2>
            <p>
              Si tienes alguna pregunta sobre estos Términos, por favor contáctanos en <a href="mailto:contacto@inmogestion.com" className="text-[#62B6CB] hover:underline">contacto@inmogestion.com</a>.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}