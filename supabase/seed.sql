insert into users (id, email) values ('usr_seed', 'owner@example.com') on conflict do nothing;
insert into policies (user_id, per_diem, receipt_required_over, restricted_categories)
values ('usr_seed', 60, 25, '["Gifts > $100"]') on conflict do nothing;
