import React, { useEffect } from 'react';
import tw, { styled } from 'twin.macro';
import { Container, Typography } from '@mui/material';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

/* ———  Estilos ——— */
const Section = styled.section`
    ${tw`py-12`}
    scroll-margin-top: 100px;   /* evita que el navbar tape los anchors */
`;

const AnchorTitle = styled(Typography)`
    ${tw`text-2xl md:text-3xl font-bold mb-4`}
`;

const Paragraph = styled(Typography)`
    ${tw`text-justify mb-4 leading-relaxed`}
`;

/* ———  Componente ——— */
const PrivacyPolicyPage = () => {
    /* Lleva al inicio de la página al montar el componente                */
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, []);

    return (
        <div tw="flex flex-col min-h-screen">
            {/* ① Barra de navegación (pública) */}
            <Navbar />

            {/* ② Contenido principal */}
            <main tw="flex-grow bg-gray-50">
                <Container maxWidth="md" tw="pt-28 pb-20">
                    {/* ── Encabezado ─────────────────────────────────────── */}
                    <AnchorTitle component="h1" variant="h3" align="center">
                        Política de Privacidad
                    </AnchorTitle>
                    <Paragraph align="center" sx={{ fontStyle: 'italic' }}>
                        Vigente desde el 18 de abril de 2025
                    </Paragraph>

                    {/* ── 1. Introducción ──────────────────────────────── */}
                    <Section id="introduccion">
                        <AnchorTitle component="h2">1.&nbsp;Introducción</AnchorTitle>
                        <Paragraph>
                            Transportes Luvan, S.A. (“<strong>Transportes Luvan</strong>”, “nosotros” o “nuestro”)
                            se compromete a proteger su privacidad y a tratar sus datos personales de forma
                            transparente y segura. Esta Política de Privacidad describe&nbsp;qué información
                            recopilamos a través de la aplicación móvil&nbsp;<em>Transportes Luvan</em>
                            (la “<strong>Aplicación</strong>”), con qué finalidad la usamos, con quién la
                            compartimos, y los derechos que asisten a los usuarios conforme a la legislación
                            vigente —incluyendo el Reglamento (UE) 2016/679&nbsp;(GDPR) y la Ley&nbsp;61‑2017&nbsp;de
                            Protección de Datos Personales de Guatemala.
                        </Paragraph>
                    </Section>

                    {/* ── 2. Información que Recopilamos ───────────────── */}
                    <Section id="informacion-que-recopilamos">
                        <AnchorTitle component="h2">
                            2.&nbsp;Información que recopilamos
                        </AnchorTitle>

                        <Paragraph>
                            Para operar la Aplicación y proveer nuestros servicios de transporte, recopilamos
                            los siguientes tipos de datos:
                        </Paragraph>

                        <Paragraph component="div">
                            <ul tw="list-disc pl-6 space-y-2">
                                <li>
                                    <strong>Datos de registro de cuenta:</strong> nombre completo, correo electrónico,
                                    número de teléfono, rol (padre, piloto, monitora o supervisor) y credenciales de
                                    acceso cifradas.
                                </li>
                                <li>
                                    <strong>Información de ruta:</strong> ubicación geográfica en tiempo real del bus
                                    (solo mientras la ruta está activa), identificador de la unidad, hora de inicio y
                                    fin del trayecto.
                                </li>
                                <li>
                                    <strong>Datos de estudiantes:</strong> nombre del estudiante, colegio, y ruta
                                    asignada. Estos datos son introducidos por el colegio y solo visibles para
                                    usuarios autorizados (padres, monitoras y supervisores).
                                </li>
                                <li>
                                    <strong>Registros técnicos:</strong> dirección IP, modelo del dispositivo, sistema
                                    operativo, versión de la app, y registros de errores para fines de
                                    diagnóstico y seguridad.
                                </li>
                            </ul>
                        </Paragraph>
                    </Section>

                    {/* ── 3. Finalidades y Bases Legales ───────────────── */}
                    <Section id="uso-de-la-informacion">
                        <AnchorTitle component="h2">
                            3.&nbsp;Cómo usamos su información
                        </AnchorTitle>
                        <Paragraph component="div">
                            <ul tw="list-disc pl-6 space-y-2">
                                <li>
                                    <strong>Prestación del servicio:</strong> mostrar al piloto la ruta asignada,
                                    permitir al supervisor monitorear las unidades y ofrecer a los padres la
                                    información del trayecto en tiempo real.
                                </li>
                                <li>
                                    <strong>Seguridad y prevención de fraudes:</strong> detectar usos indebidos,
                                    proteger las cuentas y garantizar la integridad de los datos.
                                </li>
                                <li>
                                    <strong>Mejora de la Aplicación:</strong> analizar métricas de rendimiento y
                                    registrar errores para optimizar la experiencia del usuario.
                                </li>
                                <li>
                                    <strong>Comunicaciones operativas:</strong> enviar notificaciones
                                    (push o correo) sobre cambios de ruta, mantenimiento o actualizaciones de la
                                    política.
                                </li>
                            </ul>
                        </Paragraph>

                        <Paragraph>
                            La base legal principal es la ejecución del contrato de transporte (Art.&nbsp;6 (1)(b)
                            GDPR). Ciertos tratamientos pueden basarse en nuestro interés legítimo
                            (Art.&nbsp;6 (1)(f)) o en su consentimiento (Art.&nbsp;6 (1)(a)), el cual podrá
                            revocar en cualquier momento.
                        </Paragraph>
                    </Section>

                    {/* ── 4. Compartición de Datos ────────────────────── */}
                    <Section id="comparticion-de-datos">
                        <AnchorTitle component="h2">
                            4.&nbsp;Compartición de la información
                        </AnchorTitle>
                        <Paragraph component="div">
                            <ul tw="list-disc pl-6 space-y-2">
                                <li>
                                    <strong>Personal interno autorizado:</strong> conductores, monitoras y supervisores
                                    acceden únicamente a la información necesaria para cumplir sus funciones.
                                </li>
                                <li>
                                    <strong>Proveedores de servicios&nbsp;IT:</strong> alojamiento en la nube, servicios
                                    de autenticación y envío de notificaciones&nbsp;push, los cuales tratan datos en
                                    nuestro nombre bajo acuerdos de confidencialidad (p.&nbsp;ej. Firebase
                                    Authentication y Cloud Hosting).
                                </li>
                                <li>
                                    <strong>Autoridades competentes:</strong> cuando exista obligación legal o
                                    requerimiento judicial.
                                </li>
                            </ul>
                        </Paragraph>
                    </Section>

                    {/* ── 5. Seguridad de los Datos ───────────────────── */}
                    <Section id="seguridad-de-datos">
                        <AnchorTitle component="h2">
                            5.&nbsp;Seguridad de los datos
                        </AnchorTitle>
                        <Paragraph>
                            Implementamos cifrado TLS 1.3 para las comunicaciones, hash bcrypt para contraseñas,
                            y controles de acceso basados en roles. Realizamos copias de seguridad encriptadas y
                            revisiones periódicas de seguridad siguiendo las mejores prácticas de OWASP MASVS.
                        </Paragraph>
                    </Section>

                    {/* ── 6. Retención ────────────────────────────────── */}
                    <Section id="retencion">
                        <AnchorTitle component="h2">
                            6.&nbsp;Conservación de la información
                        </AnchorTitle>
                        <Paragraph>
                            Los datos de la cuenta se retendrán mientras su perfil permanezca activo o mientras
                            sea necesario para cumplir nuestras obligaciones contractuales y legales. Los registros
                            de rutas se almacenan durante 12 meses para auditorías internas y luego se anonimizan o
                            eliminan de forma segura.
                        </Paragraph>
                    </Section>

                    {/* ── 7. Derechos del Usuario ─────────────────────── */}
                    <Section id="derechos">
                        <AnchorTitle component="h2">
                            7.&nbsp;Sus derechos
                        </AnchorTitle>
                        <Paragraph component="div">
                            Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y
                            portabilidad escribiendo a&nbsp;
                            <a href="mailto:administracion@transportesluvan.com">
                                administracion@transportesluvan.com
                            </a>
                            . Responderemos en un plazo máximo de 15 días hábiles.
                        </Paragraph>
                    </Section>

                    {/* ── 8. Menores de Edad ──────────────────────────── */}
                    <Section id="menores">
                        <AnchorTitle component="h2">
                            8.&nbsp;Privacidad de menores
                        </AnchorTitle>
                        <Paragraph>
                            La Aplicación gestiona información de estudiantes únicamente con el
                            consentimiento explícito del centro educativo y de los padres o tutores legales.
                            No recabamos datos directamente de menores de 13 años.
                        </Paragraph>
                    </Section>

                    {/* ── 9. Permisos de la Aplicación ────────────────── */}
                    <Section id="permisos">
                        <AnchorTitle component="h2">
                            9.&nbsp;Permisos solicitados por la Aplicación
                        </AnchorTitle>
                        <Paragraph component="div">
                            <ul tw="list-disc pl-6 space-y-2">
                                <li>
                                    <strong>Ubicación (Precisa / Segundo plano):</strong> necesaria para trazar el
                                    recorrido del bus y mostrarlo a supervisores y padres. Solo se activa cuando el
                                    piloto inicia la ruta y se detiene al finalizarla.
                                </li>
                                <li>
                                    <strong>Notificaciones&nbsp;Push:</strong> para avisar de cambios de ruta o llegada
                                    del bus.
                                </li>
                                <li>
                                    <strong>Conexión de red:</strong> acceso a internet para sincronizar los datos.
                                </li>
                            </ul>
                        </Paragraph>
                    </Section>

                    {/* ── 10. Servicios de Terceros ───────────────────── */}
                    <Section id="terceros">
                        <AnchorTitle component="h2">
                            10.&nbsp;Servicios de terceros
                        </AnchorTitle>
                        <Paragraph component="div">
                            La Aplicación utiliza:
                            <ul tw="list-disc pl-6 mt-2 space-y-2">
                                <li>
                                    <strong>Firebase Authentication:</strong> gestión de usuarios y
                                    autenticación multifactor (MFA).
                                </li>
                                <li>
                                    <strong>Firebase Cloud Messaging:</strong> envío de notificaciones push.
                                </li>
                                <li>
                                    <strong>Google Maps SDK:</strong> visualización de rutas en el mapa.
                                </li>
                            </ul>
                            Estos proveedores pueden procesar datos limitados
                            (p.&nbsp;ej.&nbsp;token del dispositivo) según sus propias políticas de privacidad.
                        </Paragraph>
                    </Section>

                    {/* ── 11. Cambios en la Política ──────────────────── */}
                    <Section id="cambios">
                        <AnchorTitle component="h2">
                            11.&nbsp;Cambios a esta Política
                        </AnchorTitle>
                        <Paragraph>
                            Publicaremos cualquier modificación en esta página e indicaremos la fecha de “Última
                            actualización”. Le notificaremos por la Aplicación o correo si los cambios son
                            significativos.
                        </Paragraph>
                    </Section>

                    {/* ── 12. Contacto ────────────────────────────────── */}
                    <Section id="contacto-pp">
                        <AnchorTitle component="h2">
                            12.&nbsp;Contacto
                        </AnchorTitle>
                        <Paragraph>
                            Si tiene preguntas sobre esta Política de Privacidad o sobre el tratamiento de sus
                            datos, puede contactarnos en:
                        </Paragraph>
                        <Paragraph component="div">
                            Transportes Luvan, S.A.<br />
                            4a Calle 11‑11, Zona 7 de Mixco, Ciudad de Guatemala<br />
                            Tel: (+502)&nbsp;3748‑1552<br />
                            Correo:&nbsp;
                            <a href="mailto:administracion@transportesluvan.com">
                                administracion@transportesluvan.com
                            </a>
                        </Paragraph>
                    </Section>
                </Container>
            </main>

            {/* ③ Pie de página */}
            <Footer />
        </div>
    );
};

export default PrivacyPolicyPage;
