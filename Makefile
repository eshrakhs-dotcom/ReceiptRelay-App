run:
	npm run dev

build:
	npm run build

lint:
	npm run lint

seed:
	supabase db push
	supabase db reset --use-migra
