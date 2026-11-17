begin;

select plan(55);

select has_table('public', 'seminar_survey_versions', 'published evaluation surveys have immutable versions');
select has_table('public', 'evaluation_responses', 'student evaluation responses have a dedicated table');
select has_function('private', 'is_evaluation_eligible', ARRAY['uuid', 'timestamp with time zone'], 'evaluation eligibility is centralized in a private helper');
select has_function('public', 'list_evaluations_due', ARRAY[]::text[], 'students can request the evaluations that are currently due');
select has_function('public', 'get_evaluation_survey', ARRAY['uuid'], 'eligible students can read a published survey snapshot');
select has_function('public', 'submit_evaluation', ARRAY['uuid', 'text', 'integer', 'jsonb'], 'students submit answers through a validating database function');
select has_function('public', 'get_org_seminar_evaluation', ARRAY['uuid', 'jsonb', 'integer'], 'organizations read anonymized, paginated evaluation data');
select ok(not coalesce(has_function_privilege('authenticated', to_regprocedure('private.is_evaluation_eligible(uuid,timestamp with time zone)'), 'EXECUTE'), false), 'authenticated users cannot execute the private eligibility helper');
select ok(not coalesce(has_function_privilege('anon', to_regprocedure('public.submit_evaluation(uuid,text,integer,jsonb)'), 'EXECUTE'), false), 'anonymous users cannot submit evaluations');
select ok(not coalesce(has_table_privilege('authenticated', to_regclass('public.evaluation_responses'), 'INSERT'), false), 'students cannot write directly to evaluation response rows');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000901@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000902@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000903@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000904', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000904@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000905', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000905@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000906', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000906@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000907', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000907@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, slug, name)
values
  ('00000000-0000-4000-8000-000000000911', 'evaluation-test-org', 'Evaluation Test Organization'),
  ('00000000-0000-4000-8000-000000000912', 'evaluation-other-org', 'Other Evaluation Organization');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values
  ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000905', 'org_member', 'active', 'Member', now()),
  ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000906', 'org_member', 'active', 'Member', now());

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, required_attendance_percent,
  publication_status, published_at, created_by
)
values (
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000911',
  'EVALUATION-ELIGIBILITY', 'Evaluation Eligibility', 'Evaluation test fixture', 'seminar', 'Speaker',
  'CCS Hall', 'CCS', now() - interval '90 minutes', now() + interval '30 minutes', 10, 60,
  'published', now(), '00000000-0000-4000-8000-000000000905'
);

insert into public.registrations (
  id, seminar_id, student_user_id, status, confirmed_at, time_in_at, time_out_at
)
values
  ('00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000901', 'confirmed', now(), now() - interval '74 minutes', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000932', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000902', 'confirmed', now(), now() - interval '73 minutes', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000933', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000903', 'confirmed', now(), now() - interval '100 minutes', null),
  ('00000000-0000-4000-8000-000000000934', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000904', 'cancelled', null, now() - interval '100 minutes', now() - interval '2 minutes');

insert into public.seminar_survey_versions (id, seminar_id, version, source_survey_id, definition, created_by)
values (
  '00000000-0000-4000-8000-000000000941',
  '00000000-0000-4000-8000-000000000921',
  1,
  'evaluation-survey-1',
  '{"id":"evaluation-survey-1","version":1,"seminarId":"00000000-0000-4000-8000-000000000921","title":"Evaluation","instructions":"","sections":[{"id":"main","title":"Evaluation","questions":[{"id":"scale","type":"scale","required":true,"prompt":"Rate the session","min":1,"max":5,"startLabel":"Low","endLabel":"High"},{"id":"choice","type":"choice","required":false,"prompt":"Choose one","options":[{"value":"good","label":"Good"},{"value":"fair","label":"Fair"}]},{"id":"checks","type":"checkbox","required":false,"prompt":"Choose many","options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]},{"id":"paragraph","type":"paragraph","required":false,"prompt":"Comment","maxLength":10}]}]}',
  '00000000-0000-4000-8000-000000000905'
);

insert into public.seminar_drafts (
  id, organization_id, editing_seminar_id, published_seminar_id, created_by,
  certificate_template, survey_definition
)
select
  '00000000-0000-4000-8000-000000000944', seminar.organization_id, seminar.id, seminar.id,
  '00000000-0000-4000-8000-000000000905',
  '{"backgroundUrl":"data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=","nameBox":{"x":10,"y":10,"width":100,"height":20,"fontFamily":"Outfit","fontSize":12,"fontWeight":700,"align":"center","color":"#000000"}}',
  version_row.definition
from public.seminars as seminar
join public.seminar_survey_versions as version_row on version_row.seminar_id = seminar.id and version_row.version = 1
where seminar.id = '00000000-0000-4000-8000-000000000921';

select ok(private.is_evaluation_eligible('00000000-0000-4000-8000-000000000931', now()), 'exact attendance threshold qualifies before the seminar ends');
select ok(not private.is_evaluation_eligible('00000000-0000-4000-8000-000000000932', now()), 'one minute below threshold is ineligible');
select ok(not private.is_evaluation_eligible('00000000-0000-4000-8000-000000000933', now()), 'Time-In without a validated Time-Out is ineligible');
select ok(not private.is_evaluation_eligible('00000000-0000-4000-8000-000000000934', now()), 'cancelled registrations are ineligible');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.list_evaluations_due() where seminar_id = '00000000-0000-4000-8000-000000000921'), 1, 'eligible evaluation is due before the scheduled seminar end');
select is(public.get_evaluation_survey('00000000-0000-4000-8000-000000000921')->>'id', 'evaluation-survey-1', 'eligible student reads the published survey snapshot');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"9"}')$$, 'P0001', 'validation_failed', 'out-of-range scale answer is rejected');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"choice":"invalid"}')$$, 'P0001', 'validation_failed', 'answer outside choice options is rejected');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"4","checks":"not-json"}')$$, 'P0001', 'validation_failed', 'malformed checkbox answer is rejected');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"4","paragraph":"01234567890"}')$$, 'P0001', 'validation_failed', 'paragraph answer exceeding its question limit is rejected');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"4","unknown":"answer"}')$$, 'P0001', 'validation_failed', 'unknown question ids are rejected');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"choice":"good"}')$$, 'P0001', 'validation_failed', 'missing required answer is rejected');

select lives_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"4","choice":"good","checks":"[\"a\",\"b\"]","paragraph":"clear"}')$$, 'valid answers are accepted');
select is((select count(*)::integer from public.certificate_issuances where registration_id = '00000000-0000-4000-8000-000000000931'), 1, 'evaluation submission creates one certificate issuance');
select ok((select serial ~ '^SNX-[0-9A-F]{32}$' from public.certificate_issuances where registration_id = '00000000-0000-4000-8000-000000000931'), 'certificate serial is assigned by the database');
select is(public.get_my_certificate('00000000-0000-4000-8000-000000000921')->>'serial', (select serial from public.certificate_issuances where registration_id = '00000000-0000-4000-8000-000000000931'), 'student can read own certificate issuance');
select is((select count(*)::integer from public.certificate_issuances), 1, 'certificate issuance row-level security exposes only the current student record');
select is(public.get_certificate_generation_input('00000000-0000-4000-8000-000000000921')->'template'->>'backgroundUrl', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'generation input contains the immutable template snapshot');
select ok((select evaluation_submitted_at is not null from public.registration_read_model where id = '00000000-0000-4000-8000-000000000931'), 'student registration read model exposes the server submission timestamp');
select is((select count(*)::integer from public.list_evaluations_due() where seminar_id = '00000000-0000-4000-8000-000000000921'), 0, 'submitted evaluation is no longer due');
select throws_ok($$select public.get_evaluation_survey('00000000-0000-4000-8000-000000000921')$$, 'P0001', 'conflict', 'submitted student cannot reopen evaluation for edits');
select is((public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"4","choice":"good","checks":"[\"a\",\"b\"]","paragraph":"clear"}')->>'certificateSerial'), (select serial from public.certificate_issuances where registration_id = '00000000-0000-4000-8000-000000000931'), 'exact submission retry returns the original certificate serial');
select is((select count(*)::integer from public.certificate_issuances where registration_id = '00000000-0000-4000-8000-000000000931'), 1, 'exact evaluation retry does not duplicate the certificate issuance');
select throws_ok($$select public.submit_evaluation('00000000-0000-4000-8000-000000000921', 'evaluation-survey-1', 1, '{"scale":"5"}')$$, 'P0001', 'conflict', 'different second answer payload conflicts with the immutable response');

reset role;
select is((select count(*)::integer from public.evaluation_responses where registration_id = '00000000-0000-4000-8000-000000000931'), 1, 'retries do not create another response');
insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at, time_in_at, time_out_at)
values ('00000000-0000-4000-8000-000000000935', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000907', 'confirmed', now(), now() - interval '74 minutes', now() - interval '2 minutes');
insert into public.evaluation_responses (id, seminar_id, registration_id, student_user_id, survey_version_id, answers, submitted_at)
values ('00000000-0000-4000-8000-000000000943', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000935', '00000000-0000-4000-8000-000000000907', '00000000-0000-4000-8000-000000000941', '{"scale":"4","choice":"good","checks":"[\"a\",\"b\"]","paragraph":"clear"}', pg_catalog.clock_timestamp() + interval '1 second');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000905","role":"authenticated"}', true);
set local role authenticated;
select is(public.get_org_seminar_certificates('00000000-0000-4000-8000-000000000921')->'records'->0->>'serial', (select serial from public.certificate_issuances where registration_id = '00000000-0000-4000-8000-000000000931'), 'active organization member can read seminar certificate state');
select ok(not ((public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'items'->0) ? 'respondentLabel'), 'organization response omits a sequential respondent label');
select ok(not ((public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'items'->0) ? 'submittedAt'), 'organization response omits submission timing');
select ok(not ((public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'items'->0) ? 'student_user_id'), 'organization response omits student identity');
select is(jsonb_array_length(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'surveyVersions'), 1, 'organization read includes the survey snapshot for responses');
select ok(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'nextCursor' is not null, 'response page has a cursor when more responses remain');
select ok(not ((public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'nextCursor') ? 'submittedAt'), 'response cursor contains no timing key');
select ok((public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'nextCursor', 1)->'responses'->'items'->0->>'id') is not null, 'cursor returns the next response by opaque UUID order');
select is(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'responses'->'nextCursor', 1)->'aggregates'->0->>'responseCount', '2', 'aggregate totals remain full-set values on later pages');
select is(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'aggregates'->0->'questions'->0->>'mean', '4.00', 'scale aggregate includes the mean across all submitted answers');
select is(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'aggregates'->0->'questions'->1->'distribution'->0->>'count', '2', 'choice aggregate counts answers by option');
select is(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'aggregates'->0->'questions'->2->'distribution'->1->>'count', '2', 'checkbox aggregate counts selected options');
select is(public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 1)->'aggregates'->0->'questions'->3->'comments'->>0, 'clear', 'paragraph aggregate includes anonymized comments');

reset role;
update public.seminar_drafts
set published_seminar_id = '00000000-0000-4000-8000-000000000921',
    survey_definition = pg_catalog.jsonb_set(survey_definition, '{sections,0,questions,0,prompt}', '"Updated evaluation question"'::jsonb)
where id = '00000000-0000-4000-8000-000000000944';
select is((select count(*)::integer from public.seminar_survey_versions where seminar_id = '00000000-0000-4000-8000-000000000921'), 2, 'republishing a changed survey creates a new immutable snapshot');
update public.seminar_drafts
set published_seminar_id = '00000000-0000-4000-8000-000000000921'
where id = '00000000-0000-4000-8000-000000000944';
select is((select count(*)::integer from public.seminar_survey_versions where seminar_id = '00000000-0000-4000-8000-000000000921'), 2, 'republishing unchanged survey does not create a redundant snapshot');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.get_evaluation_survey('00000000-0000-4000-8000-000000000921')$$, 'P0001', 'not_available', 'student below the attendance threshold cannot read the survey');
select throws_ok($$select public.get_my_certificate('00000000-0000-4000-8000-000000000921')$$, 'P0001', 'not_found', 'student without issued eligibility cannot read another student certificate');
select is((select count(*)::integer from public.certificate_issuances), 0, 'another student cannot read the certificate issuance row');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000906","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.get_org_seminar_evaluation('00000000-0000-4000-8000-000000000921', null, 20)$$, 'P0001', 'not_found', 'unrelated organization cannot read responses');
select throws_ok($$select public.get_org_seminar_certificates('00000000-0000-4000-8000-000000000921')$$, 'P0001', 'not_found', 'unrelated organization cannot read certificate records');

select * from finish();
rollback;
