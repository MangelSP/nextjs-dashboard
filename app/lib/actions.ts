'use server'

import {z} from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@vercel/postgres';
import { signIn } from "@/auth";
import { AuthError } from 'next-auth';


export type FormState =
| {
    errors?: {
      name?: string[]
      email?: string[]
      password?: string[]
    }
    message?: string
  }
| undefined


export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

  const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error:"Please select a customer"
    }),
    amount: z.coerce.number().gt(0,{message:"Please enter an amount greate than $0."}),
    status: z.enum(['pending', 'paid'],{
        invalid_type_error:"Please select an invoice status"
    }),
    date: z.string(),
});

export const SignupFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters long.' })
    .trim(),
  email: z.string().email({ message: 'Please enter a valid email.' }).trim(),
  password: z
    .string()
    .min(8, { message: 'Be at least 8 characters long' })
    .regex(/[a-zA-Z]/, { message: 'Contain at least one letter.' })
    .regex(/[0-9]/, { message: 'Contain at least one number.' })
    .regex(/[^a-zA-Z0-9]/, {
      message: 'Contain at least one special character.',
    })
    .trim(),
})

const CreateInvoice = FormSchema.omit({id:true,date:true})
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState:State,formData:FormData){

    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    if(!validatedFields.success){
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
          };
    }
    const {customerId, amount, status} = CreateInvoice.parse({
        customerId:formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
          };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');

}


export async function updateInvoice(id: string,prevState:State, formData: FormData) {

  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
});
if(!validatedFields.success) {
  return {
    errors: validatedFields.error.flatten().fieldErrors,
    message:"Missing Fields. Failed to Updated Invoice."
  }
}
const { customerId, amount, status } = UpdateInvoice.parse({
  customerId: formData.get('customerId'),
  amount: formData.get('amount'),
  status: formData.get('status'),
});

const amountInCents = amount * 100;
 try {
      await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
 } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };

 }
 revalidatePath('/dashboard/invoices');
 redirect('/dashboard/invoices');
  }

  export async function deleteInvoice(id: string) {

   try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
   }catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
  }

  export async function authenticate(
    prevState: string | undefined,
    formData: FormData
  ) {
    let responseRedirectUrl = null;
    try {
      responseRedirectUrl = await signIn("credentials", {
        ...Object.fromEntries(formData),
        redirect: false
      });
    } catch (error) {
      console.log("error", error);
      if ((error as Error).message.includes("CredentialsSignin")) {
        return "CredentialSignin";
      }
      throw error;
    } finally {
      if (responseRedirectUrl) redirect(responseRedirectUrl);
    }
  }