-- A failed manual payment could reserve its operation ID before returning a
-- conflict. A pending operation without its payment record cannot be applied.
DELETE FROM public.applied_operations AS operation
 WHERE operation.entity = 'debt_payments'
   AND operation.operation_type = 'create'
   AND operation.result->>'status' = 'pending'
   AND NOT EXISTS (
     SELECT 1
       FROM public.debt_payments AS payment
      WHERE payment.id = operation.record_id
        AND payment.user_id = operation.user_id
   );
