import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';
import { EditorialTitle } from '../../components/public/EditorialTitle';

const PLATFORM_NAME = 'En cartelera';
const CONTACT_EMAIL = 'info@inmogestion.com';

export function TermsAndConditionsPage() {
  return (
    <PublicLayout>
      <PublicSection background="white">
        <div className="text-center mb-16">
          <EditorialTitle
            as="h1"
            lead="Términos y"
            emphasis="condiciones"
            className="text-4xl md:text-6xl"
          />
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            Última actualización: 23 de octubre de 2026
          </p>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 md:p-12">
          <div className="prose prose-lg max-w-none text-gray-700 dark:text-gray-300">
            <p>
              Estos términos regulan el acceso y el uso de {PLATFORM_NAME} («la Plataforma»), el sitio, las aplicaciones
              asociadas y el software que permite a una persona publicar una casa de alquiler temporal o un espacio para
              eventos y seguir las consultas y reservas de esa propiedad.
            </p>
            <p>
              Quien crea una cuenta o utiliza la Plataforma («el Usuario») declara haber leído estos términos. Si no está
              de acuerdo, no debe crear una cuenta ni usar el servicio. Este texto no sustituye el asesoramiento de un
              abogado.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">1. El servicio</h2>
            <p>
              La Plataforma es un software de suscripción. El Usuario carga la ficha de su casa o de su espacio, define
              precios, disponibilidad y reglas, y recibe consultas y reservas asociadas a esa publicación.
            </p>
            <p>
              La Plataforma no es la dueña del inmueble ni del espacio, no es quien alquila la estadía o el evento, y no
              es parte del contrato entre el Usuario y la persona que reserva. Ese contrato lo celebra el Usuario, bajo
              las condiciones que él publica.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">2. Cuenta</h2>
            <p>
              El registro pide datos verdaderos. El Usuario conserva la confidencialidad de sus credenciales y avisa de
              inmediato si detecta un uso no autorizado. La actividad hecha con su usuario se entiende realizada por él
              o por quien él autorizó, salvo prueba en contrario.
            </p>
            <p>
              El Usuario solo puede publicar una casa o un espacio si es el titular o si cuenta con autorización expresa
              de quien tiene derecho a alquilarlo.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">3. Publicación de la propiedad</h2>
            <p>
              El Usuario es responsable de que la ficha sea exacta y esté actualizada: descripción, fotos, ubicación,
              precio, capacidad, reglas, depósitos y disponibilidad. Las fotos y los textos tienen que corresponder al
              lugar ofrecido.
            </p>
            <p>
              Una casa de alquiler temporal y un espacio para eventos se describen según su uso. El Usuario no usa la
              ficha para ofrecer algo distinto de lo que la Plataforma permite publicar, ni para ocultar una restricción
              que cambie la decisión de quien reserva.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">4. Reservas y cancelaciones</h2>
            <p>
              Cada reserva se rige por la política de cancelación, los plazos y las condiciones que el Usuario cargó en
              la ficha de esa propiedad. El Usuario mantiene esas condiciones iguales a lo que realmente ofrece.
            </p>
            <p>
              La Plataforma muestra el estado de la reserva y los mensajes. No garantiza que una consulta se convierta
              en reserva, ni que el huésped o el organizador cumpla el pago o se presente.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">5. Planes y facturación</h2>
            <p>
              El uso de las funciones de pago de la Plataforma puede exigir un plan. Los precios, el período y lo que
              incluye cada plan están en la página de{' '}
              <Link to="/pricing" className="text-green-600 dark:text-green-400 hover:underline">
                planes y precios
              </Link>
              . Este contrato no fija montos.
            </p>
            <p>
              El plan se renueva según el período elegido en el panel, hasta que el Usuario lo cancele desde la
              configuración de la cuenta o hasta que la Plataforma lo dé de baja conforme a estos términos. La
              cancelación evita el siguiente período. Los períodos ya facturados se rigen por la ley aplicable y por lo
              informado al momento de la contratación.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">6. Pagos con Mercado Pago</h2>
            <p>
              El Usuario puede conectar una cuenta de Mercado Pago para cobrar reservas. Ese cobro ocurre entre el
              Usuario, la persona que reserva y Mercado Pago, según las condiciones de Mercado Pago.
            </p>
            <p>
              La Plataforma no es el vendedor de la estadía ni del evento, no custodia esos fondos como comercio propio
              y no responde por una demora, un rechazo o una reversión decididos por Mercado Pago o por el banco. El
              Usuario es quien debe emitir la documentación fiscal que corresponda a su actividad.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">7. Contenido del Usuario</h2>
            <p>
              El Usuario conserva los derechos sobre textos, fotos y demás material que carga. Otorga a la Plataforma
              una licencia no exclusiva, gratuita y limitada a lo necesario para alojar, mostrar y operar ese material
              dentro del servicio.
            </p>
            <p>El Usuario garantiza que su contenido:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>no infringe derechos de terceros;</li>
              <li>no es ilícito, engañoso ni contrario a la buena fe;</li>
              <li>cumple la normativa de publicidad, alquileres temporarios, eventos y datos personales que le aplique.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">8. Obligaciones del Usuario</h2>
            <p>El Usuario se obliga a:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>usar la Plataforma conforme a la ley y a estos términos;</li>
              <li>no introducir software dañino ni acceder a cuentas o datos ajenos;</li>
              <li>no usar los mensajes para fines ajenos a las consultas y reservas de sus propiedades;</li>
              <li>cumplir habilitaciones, normas de seguridad, normas locales de alquiler y tributos de su actividad.</li>
            </ul>
            <p>
              Frente a huéspedes, organizadores y autoridades, el responsable del alquiler es el Usuario. La Plataforma
              no asume ese lugar.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">9. Uso aceptable</h2>
            <p>Queda prohibido:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>publicar lugares o servicios ilícitos, o fichas con fines fraudulentos;</li>
              <li>suplantar a otra persona o alterar reseñas y métricas;</li>
              <li>extraer datos de la Plataforma de forma masiva y automatizada sin autorización.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">10. Propiedad intelectual de la Plataforma</h2>
            <p>
              El software, la interfaz y la documentación de {PLATFORM_NAME}, con exclusión del contenido del Usuario,
              pertenecen a sus titulares y están protegidos por la normativa de propiedad intelectual e industrial.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">11. Datos personales</h2>
            <p>
              El tratamiento de datos personales se rige por la Ley N.º 18.331 y sus normas reglamentarias. La Plataforma
              usa los datos de la cuenta para prestar el servicio, mantener la seguridad y responder consultas. El
              Usuario, cuando carga datos de huéspedes u organizadores, es responsable de tener una base legítima para
              hacerlo y de informarles el uso que les da.
            </p>
            <p>
              Quien quiera ejercer acceso, rectificación, actualización o supresión puede escribir a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-600 dark:text-green-400 hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">12. Relaciones de consumo</h2>
            <p>
              Cuando el Usuario actúa como consumidor final según la Ley N.º 17.250, se aplican las normas imperativas
              de esa ley y las que la reglamentan. Nada de estos términos limita un derecho que esa normativa no permita
              limitar. Si el Usuario contrata el plan para su actividad de alquiler, esa contratación se interpreta
              conforme a la calidad en la que actúa.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">13. Responsabilidad</h2>
            <p>
              El servicio se presta en el estado en que se encuentra y según su disponibilidad. En la medida en que la
              ley lo permita, {PLATFORM_NAME} no responde por lucro cesante, daño indirecto ni pérdida de datos derivada
              del uso o de la imposibilidad de uso. No promete un nivel de ocupación ni un resultado comercial.
            </p>
            <p>
              Esta limitación no cubre los supuestos en que la ley uruguaya impide excluir la responsabilidad.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">14. Suspensión y fin del acceso</h2>
            <p>
              La Plataforma puede suspender o cerrar una cuenta ante un incumplimiento de estos términos o ante un
              requerimiento legal. El Usuario puede dejar de usar el servicio en cualquier momento. Las cláusulas que
              por su naturaleza deben sobrevivir —propiedad intelectual, limitación de responsabilidad y ley aplicable—
              siguen vigentes en la medida que la ley lo permite.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">15. Cambios</h2>
            <p>
              Estos términos pueden actualizarse. Un cambio relevante se avisa en la Plataforma o por correo. El uso
              posterior implica la aceptación de la versión nueva, salvo cuando la ley exija otro procedimiento.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">16. Ley aplicable y tribunales</h2>
            <p>
              Estos términos se rigen por las leyes de la República Oriental del Uruguay. Para las controversias que no
              tengan una competencia improrrogable, las partes se someten a los tribunales de Montevideo.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-10 mb-4">17. Contacto</h2>
            <p>
              Las consultas sobre estos términos se envían a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-600 dark:text-green-400 hover:underline">
                {CONTACT_EMAIL}
              </a>{' '}
              o por el formulario de contacto del sitio.
            </p>
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}
