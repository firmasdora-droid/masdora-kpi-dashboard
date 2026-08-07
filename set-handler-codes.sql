-- ==========================================================================
-- Tetapkan kod handler untuk staff CS.
-- Kod ini digunakan untuk:
--   (a) padankan laporan chat/isu Google dengan akaun dashboard
--   (b) kawal siapa nampak pautan khas (cth "Recovery CRM" untuk MAI sahaja)
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

update profiles set handler_code = 'MAI'  where full_name ilike '%maisarah%';
update profiles set handler_code = 'TI'   where full_name ilike '%najjati%';
update profiles set handler_code = 'HAWA' where full_name ilike '%natasya%'
                                             or full_name ilike '%natasha%';

-- Semak hasil
select full_name, email, handler_code, position_code
from profiles
where handler_code is not null
   or position_code = 'CS_AGENT'
order by handler_code nulls last;
