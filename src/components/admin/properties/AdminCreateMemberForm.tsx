// src/components/admin/properties/AdminCreateMemberForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Label, TextInput } from 'flowbite-react';
import { createMember, CreateMemberRequest } from '../../../services/AdminMemberService';

const adminCreateMemberSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido.'),
  lastName: z.string().min(1, 'El apellido es requerido.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  phone: z.string().optional(),
  title: z.string().optional(),
  street: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  role: z.string().optional(),
});

export type AdminCreateMemberFormData = z.infer<typeof adminCreateMemberSchema>;

const CREATE_MEMBER_ERRORS = {
  EMAIL_EXISTS: 'El correo ya existe.',
  PHONE_EXISTS: 'El teléfono ya existe.',
  MEMBER_NOT_FOUND: 'ID de miembro no encontrado.',
  DEFAULT: 'Error al crear el miembro.',
} as const;

/**
 * Maps raw API error messages to user-friendly Spanish messages for the create-member flow.
 */
function mapCreateMemberErrorToSpanish(rawMessage: string): string {
  const msg = rawMessage.trim().toLowerCase();
  // Email already exists (Supabase Auth: "User already registered", etc.)
  if (
    msg.includes('already registered') ||
    (msg.includes('email') && (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists'))) ||
    msg.includes('user already')
  ) {
    return CREATE_MEMBER_ERRORS.EMAIL_EXISTS;
  }
  // Phone already exists (Postgres unique constraint, etc.)
  if (
    (msg.includes('phone') && (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already'))) ||
    msg.includes('members_phone') ||
    msg.includes('ix_members_phone')
  ) {
    return CREATE_MEMBER_ERRORS.PHONE_EXISTS;
  }
  // Member not found (e.g. PGRST116 "no rows", or explicit "not found")
  if (
    (msg.includes('member') && (msg.includes('not found') || msg.includes('no existe'))) ||
    msg.includes('pgrst116') ||
    msg.includes('no rows')
  ) {
    return CREATE_MEMBER_ERRORS.MEMBER_NOT_FOUND;
  }
  return CREATE_MEMBER_ERRORS.DEFAULT;
}

interface AdminCreateMemberFormProps {
  onSubmitSuccess: (userId: string) => void;
  onCancel?: () => void;
}

export function AdminCreateMemberForm({ onSubmitSuccess, onCancel }: AdminCreateMemberFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminCreateMemberFormData>({
    resolver: zodResolver(adminCreateMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      title: '',
      street: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      role: 'user',
    },
  });

  const onSubmit = async (data: AdminCreateMemberFormData) => {
    setApiError(null);
    try {
      const request: CreateMemberRequest = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
        title: data.title || undefined,
        street: data.street || undefined,
        street2: data.street2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        postalCode: data.postalCode || undefined,
        country: data.country || undefined,
        role: data.role || undefined,
      };
      const { userId } = await createMember(request);
      onSubmitSuccess(userId);
    } catch (err: unknown) {
      const errWithCode = err as Error & { errorCode?: string };
      const code = errWithCode?.errorCode;
      const rawMessage = err instanceof Error ? err.message : CREATE_MEMBER_ERRORS.DEFAULT;
      const message =
        code && code in CREATE_MEMBER_ERRORS
          ? CREATE_MEMBER_ERRORS[code as keyof typeof CREATE_MEMBER_ERRORS]
          : mapCreateMemberErrorToSpanish(rawMessage);
      setApiError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {apiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</Label>
          <TextInput
            id="firstName"
            {...register('firstName')}
            className="mt-1"
            placeholder="Nombre"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="lastName" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Apellido</Label>
          <TextInput
            id="lastName"
            {...register('lastName')}
            className="mt-1"
            placeholder="Apellido"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
        <TextInput
          id="email"
          type="email"
          {...register('email')}
          className="mt-1"
          placeholder="email@ejemplo.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</Label>
        <TextInput
          id="password"
          type="password"
          {...register('password')}
          className="mt-1"
          placeholder="Mínimo 6 caracteres"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</Label>
        <TextInput id="phone" {...register('phone')} className="mt-1" placeholder="Opcional" />
      </div>

      <div>
        <Label htmlFor="title" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Título / Cargo</Label>
        <TextInput id="title" {...register('title')} className="mt-1" placeholder="Opcional" />
      </div>

      <div>
        <Label htmlFor="street" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Dirección (calle)</Label>
        <TextInput id="street" {...register('street')} className="mt-1" placeholder="Opcional" />
      </div>
      <div>
        <Label htmlFor="street2" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Dirección línea 2</Label>
        <TextInput id="street2" {...register('street2')} className="mt-1" placeholder="Opcional" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="city" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Ciudad</Label>
          <TextInput id="city" {...register('city')} className="mt-1" placeholder="Opcional" />
        </div>
        <div>
          <Label htmlFor="state" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Estado / Provincia</Label>
          <TextInput id="state" {...register('state')} className="mt-1" placeholder="Opcional" />
        </div>
        <div>
          <Label htmlFor="postalCode" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Código postal</Label>
          <TextInput id="postalCode" {...register('postalCode')} className="mt-1" placeholder="Opcional" />
        </div>
      </div>

      <div>
        <Label htmlFor="country" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">País</Label>
        <TextInput id="country" {...register('country')} className="mt-1" placeholder="Opcional" />
      </div>

      <div>
        <Label htmlFor="role" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Rol</Label>
        <TextInput id="role" {...register('role')} className="mt-1" placeholder="user (opcional)" />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Crear miembro'}
        </Button>
        {onCancel && (
          <Button type="button" color="light" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
